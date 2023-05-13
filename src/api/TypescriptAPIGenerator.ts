import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';
import { cloneDeep } from 'lodash';
import prettier from 'prettier';

import { OpenAPISpecification } from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  BINARY_RESPONSE_TYPES,
  PATHS_LIBRARY,
  RequestGroupings,
  TagNameToEntityLabelsMap,
} from '../models/TypescriptAPIGenerator';
import { getAPIAdapterCode } from './APIFunctionsCodeGenerator';
import { generateModelMappings } from './ModelCodeGenerator';

export const API_ADAPTER_PATH = `./Adapter`;

export interface GenerateTypescriptAPIConfig {
  swaggerDocs: OpenAPISpecification;
  outputRootPath: string;
  outputInternalState?: boolean;
  requestOperationNameSource?: 'requestSummary' | 'requestOperationId';
}

export const generateTypescriptAPI = async ({
  swaggerDocs,
  outputRootPath,
  outputInternalState = false,
  requestOperationNameSource: requestOperationName = 'requestSummary',
}: GenerateTypescriptAPIConfig) => {
  swaggerDocs = cloneDeep(swaggerDocs);
  //#region Find all requests and group them by tag
  const requestGroupings = Object.keys(swaggerDocs.paths).reduce(
    (accumulator, path) => {
      Object.keys(swaggerDocs.paths[path]).forEach((method) => {
        const request = swaggerDocs.paths[path][method as RequestMethod];

        //#region Generate anonymous schemas for all responses and request bodies that are not referenced by any other schema
        const { requestBody } = request;
        const operationName = (() => {
          if (requestOperationName === 'requestSummary' && request.summary) {
            return request.summary.toCamelCase();
          }
          return request.operationId;
        })();
        const pascalCaseOperationName = operationName.toPascalCase();
        if (requestBody) {
          const { content } = requestBody;
          if (
            'application/json' in content &&
            'type' in content['application/json'].schema
          ) {
            const schemaName = `${pascalCaseOperationName}RequestPayload`;
            swaggerDocs.components.schemas[schemaName] =
              content['application/json'].schema;

            (requestBody.content as any)['application/json'].schema = {
              $ref: `#/components/schemas/${schemaName}`,
            };
          }
        }
        //#endregion

        request.tags.forEach((tag) => {
          if (!accumulator[tag]) {
            accumulator[tag] = {
              imports: {},
              requests: [],
            };
          }
          const { imports, requests } = accumulator[tag];
          if (!imports[API_ADAPTER_PATH]) {
            imports[API_ADAPTER_PATH] = [];
          }
          if (!imports[API_ADAPTER_PATH].includes(method)) {
            imports[API_ADAPTER_PATH].push(method);
          }

          requests.push({
            ...request,
            method: method as RequestMethod,
            endpointPath: path,
            operationName,
            pascalCaseOperationName,
            endpointPathName:
              (() => {
                if (
                  requestOperationName === 'requestSummary' &&
                  request.summary
                ) {
                  return request.summary.replace(/\s/g, '_').toUpperCase();
                }
                return request.operationId.replace(/\s/g, '_').toUpperCase();
              })() + `_ENDPOINT_PATH`,
            operationDescription: (() => {
              if (
                requestOperationName === 'requestSummary' &&
                request.summary
              ) {
                const [verb, ...restSummary] = request.summary.split(' ');
                return (
                  verb.replace(/[ei]+$/g, '') + 'ing ' + restSummary.join(' ')
                );
              }
            })(),
            requestBodySchemaName: (() => {
              if (
                request.requestBody &&
                'application/json' in request.requestBody.content &&
                '$ref' in request.requestBody.content['application/json'].schema
              ) {
                const requestBodySchemaName = request.requestBody.content[
                  'application/json'
                ].schema.$ref.replace('#/components/schemas/', '');
                return requestBodySchemaName;
              }
            })(),
            successResponseSchemaName: (() => {
              const successResponse = Object.keys(request.responses).find(
                (responseCode) => responseCode.startsWith('2')
              );
              if (
                successResponse &&
                request.responses[successResponse] &&
                'application/json' in request.responses[successResponse].content
              ) {
                const successResponseSchemaName = (
                  request.responses[successResponse] as any
                ).content['application/json'].schema.$ref.replace(
                  '#/components/schemas/',
                  ''
                );
                return successResponseSchemaName;
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const pathParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'path'
                );
                if (pathParameters.length > 0) {
                  const pathParamType = `TemplatePath`;
                  if (!imports[PATHS_LIBRARY]) {
                    imports[PATHS_LIBRARY] = [];
                  }
                  if (!imports[PATHS_LIBRARY].includes(pathParamType)) {
                    imports[PATHS_LIBRARY].push(pathParamType);
                  }
                  return {
                    pathParameters,
                  };
                }
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const headerParameters = request.parameters.filter(
                  (parameter) => {
                    return (
                      parameter.in === 'header' &&
                      !parameter.name.match(/authorization/gi)
                    );
                  }
                );
                if (headerParameters.length > 0) {
                  return {
                    headerParameters,
                    headerParametersModelReference: `${pascalCaseOperationName}HeaderParams`,
                  };
                }
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const queryParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'query'
                );
                if (queryParameters.length > 0) {
                  return {
                    queryParameters,
                    queryParametersModelReference: `${pascalCaseOperationName}QueryParams`,
                  };
                }
              }
            })(),
          });
        });
      });
      return accumulator;
    },
    {} as RequestGroupings
  );
  //#endregion

  //#region Generate tag to entity mappings
  const tagToEntityLabelMappings = [
    ...Object.keys(requestGroupings),
    'Utils',
  ].reduce((accumulator, tag) => {
    const labelPlural = tag;
    const labelSingular = (() => {
      if (tag.endsWith('s')) {
        return tag.slice(0, -1);
      }
      return tag;
    })();
    accumulator[tag] = {
      'Entities Label': labelPlural,
      'Entity Label': labelSingular,

      'entities label': labelPlural.toLowerCase(),
      'entity label': labelSingular.toLowerCase(),

      PascalCaseEntities: labelPlural.toPascalCase(),
      PascalCaseEntity: labelSingular.toPascalCase(),

      camelCaseEntities: labelPlural.toCamelCase(),
      camelCaseEntity: labelSingular.toCamelCase(),

      UPPER_CASE_ENTITIES: labelPlural.replace(/\s/g, '_').toUpperCase(),
      UPPER_CASE_ENTITY: labelSingular.replace(/\s/g, '_').toUpperCase(),

      'kebab-case-entities': labelPlural.toKebabCase(),
      'kebab-case-entity': labelSingular.toKebabCase(),
    };
    return accumulator;
  }, {} as TagNameToEntityLabelsMap);
  //#endregion

  //#region Generate model mappings.
  const {
    entitySchemaGroups,
    schemaToEntityMappings,
    schemaEntityReferences,
    models,
    modelsToValidationSchemaMappings,
  } = generateModelMappings({
    requestGroupings,
    swaggerDocs,
  });
  //#endregion

  //#region Write model output files
  const modelsOutputFilePath = `${outputRootPath}/models`;
  ensureDirSync(modelsOutputFilePath);
  Object.keys(models).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const modelFileName = `${PascalCaseEntities}.ts`;
    const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;

    const entityModelsOutputCode = Object.values(models[tag].models)
      .sort(
        (
          { referencedSchemas: aReferencedSchemas, name: aName },
          { referencedSchemas: bReferencedSchemas, name: bName }
        ) => {
          if (aReferencedSchemas && !bReferencedSchemas) {
            return 1;
          }
          if (!aReferencedSchemas && bReferencedSchemas) {
            return -1;
          }
          if (aReferencedSchemas && bReferencedSchemas) {
            if (aReferencedSchemas.includes(bName)) {
              return 1;
            }
            if (bReferencedSchemas.includes(aName)) {
              return -1;
            }
          }
          return 0;
        }
      )
      .map((model) => model.zodValidationSchemaCode)
      .join('\n\n');

    writeFileSync(
      entityModelsOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports: models[tag].imports,
          }),
          entityModelsOutputCode,
        ].join('\n\n'),
        {
          filepath: entityModelsOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  });

  const modelsIndexOutputFilePath = `${modelsOutputFilePath}/index.ts`;
  writeFileSync(
    modelsIndexOutputFilePath,
    prettier.format(
      Object.keys(models)
        .map((tag) => {
          return `export * from './${tagToEntityLabelMappings[tag].PascalCaseEntities}';`;
        })
        .join('\n'),
      {
        filepath: modelsIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write api output files
  const apiOutputFilePath = `${outputRootPath}/api`;
  ensureDirSync(apiOutputFilePath);
  Object.keys(requestGroupings).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const apiFileName = `${PascalCaseEntities}.ts`;
    const entityAPIOutputFilePath = `${apiOutputFilePath}/${apiFileName}`;

    //#region Generate entity api endpoint paths
    const entityAPIEndpointPathsOutputCode = requestGroupings[tag].requests
      .map(({ endpointPath, endpointPathName, pathParameters }) => {
        if (pathParameters && pathParameters.length > 0) {
          const parametersCode = pathParameters
            .reduce((accumulator, { name }) => {
              accumulator.push(`${name}: string`);
              return accumulator;
            }, [] as string[])
            .join(';\n');
          return `export const ${endpointPathName}: TemplatePath<{${parametersCode}}> = '${endpointPath}';`;
        }
        return `export const ${endpointPathName} = '${endpointPath}';`;
      })
      .join('\n');
    //#endregion

    const dataKeyVariableName = `${tagToEntityLabelMappings[tag].UPPER_CASE_ENTITIES}_DATA_KEY`;
    const { imports } = requestGroupings[tag];

    //#region Generate entity api request functions
    const entityAPIOutputCode = requestGroupings[tag].requests
      .map(
        ({
          method,
          operationName,
          endpointPathName,
          operationDescription,
          description,
          pathParameters,
          headerParameters,
          headerParametersModelReference,
          queryParameters,
          queryParametersModelReference,
          requestBody,
          requestBodySchemaName,
          successResponseSchemaName,
        }) => {
          const { jsDocCommentSnippet, paramsString, returnValueString } =
            (() => {
              const jsDocCommentLines: string[] = [];

              if (description) {
                jsDocCommentLines.push(description, '');
              }
              if (pathParameters && pathParameters.length > 0) {
                jsDocCommentLines.push(
                  ...pathParameters.map(({ name, description = '' }) => {
                    return `@param ${name} ${description}`.trim();
                  })
                );
              }

              const paramsString = [
                ...(() => {
                  if (pathParameters) {
                    return pathParameters.map(({ name }) => {
                      // TODO: Generate the path parameter type
                      return `${name}: string`;
                    });
                  }
                  return [];
                })(),
                ...(() => {
                  if (requestBody && requestBodySchemaName) {
                    jsDocCommentLines.push(
                      `@param requestPayload ${
                        requestBody.description || ''
                      }`.trim()
                    );

                    const schemaSource = `../models/${schemaToEntityMappings[requestBodySchemaName]}`;
                    if (!imports[schemaSource]) {
                      imports[schemaSource] = [];
                    }
                    if (
                      !imports[schemaSource].includes(requestBodySchemaName)
                    ) {
                      imports[schemaSource].push(requestBodySchemaName);
                    }
                    return [`requestPayload: ${requestBodySchemaName}`];
                  }
                  return [];
                })(),
                ...(() => {
                  if (
                    headerParametersModelReference &&
                    headerParameters &&
                    headerParameters.length > 0
                  ) {
                    jsDocCommentLines.push(`@param headers`);
                    return [`headers: ${headerParametersModelReference}`];
                  }
                  return [];
                })(),
                ...(() => {
                  if (
                    queryParametersModelReference &&
                    queryParameters &&
                    queryParameters.length > 0
                  ) {
                    jsDocCommentLines.push(`@param queryParams`);
                    return [
                      `queryParams: ${queryParametersModelReference} = {}`,
                    ];
                  }
                  return [];
                })(),
                `{ ...rest }: RequestOptions = {}`,
              ].join(', ');

              if (!imports[API_ADAPTER_PATH].includes('RequestOptions')) {
                imports[API_ADAPTER_PATH].push('RequestOptions');
              }

              let returnValueString = 'data';

              if (successResponseSchemaName) {
                const successResponseValidationSchemaName =
                  modelsToValidationSchemaMappings[successResponseSchemaName]
                    .zodValidationSchemaName;
                const validationSchemaSource = `../models/${schemaToEntityMappings[successResponseSchemaName]}`;

                if (!imports[validationSchemaSource]) {
                  imports[validationSchemaSource] = [];
                }
                if (
                  !imports[validationSchemaSource].includes(
                    successResponseValidationSchemaName
                  )
                ) {
                  imports[validationSchemaSource].push(
                    successResponseValidationSchemaName
                  );
                }

                returnValueString = `${successResponseValidationSchemaName}.parse(data)`;

                jsDocCommentLines.push(`@returns ${successResponseSchemaName}`); // TODO: Replace this with the response description.
              }

              return {
                jsDocCommentSnippet: (() => {
                  if (jsDocCommentLines.length > 0) {
                    const linesString = jsDocCommentLines
                      .map((line) => {
                        return ` * ${line}`;
                      })
                      .join('\n');
                    return `
                  /**
                   ${linesString}
                  */
                `
                      .trimIndent()
                      .trim();
                  }
                  return '';
                })(),
                paramsString,
                returnValueString,
              };
            })();

          const interpolatedEndpointPathString = (() => {
            const interpolatedEndpointPathString = (() => {
              if (pathParameters && pathParameters.length > 0) {
                if (!imports[PATHS_LIBRARY]) {
                  imports[PATHS_LIBRARY] = [];
                }
                if (!imports[PATHS_LIBRARY].includes(`getInterpolatedPath`)) {
                  imports[PATHS_LIBRARY].push(`getInterpolatedPath`);
                }
                return `getInterpolatedPath(${endpointPathName}, {
                  ${pathParameters.map(({ name }) => name).join(',\n')}
                })`;
              }
              return endpointPathName;
            })();

            if (queryParameters && queryParameters.length > 0) {
              if (!imports[PATHS_LIBRARY]) {
                imports[PATHS_LIBRARY] = [];
              }
              if (!imports[PATHS_LIBRARY].includes(`addSearchParams`)) {
                imports[PATHS_LIBRARY].push(`addSearchParams`);
              }
              return `addSearchParams(${interpolatedEndpointPathString},
                {...queryParams}, {
                arrayParamStyle: 'append'
              })`;
            }
            return interpolatedEndpointPathString;
          })();

          const isBinaryResponseType = Boolean(
            successResponseSchemaName &&
              BINARY_RESPONSE_TYPES.includes(successResponseSchemaName)
          );

          const cacheIdString = (() => {
            if (method.match(/get/gi)) {
              return `\ncacheId: ${dataKeyVariableName},`;
            }
            return '';
          })();

          return `
          ${jsDocCommentSnippet}
          export const ${operationName} = async (${paramsString}) => {
            const { data } = await ${method}(${interpolatedEndpointPathString}, {
              label: '${operationDescription}',${
            headerParameters && headerParameters.length > 0 ? '\nheaders,' : ''
          }${requestBody ? '\ndata: requestPayload,' : ''}${cacheIdString}${
            isBinaryResponseType ? "\nresponseType: 'blob'," : ''
          }
              ...rest,
            });
            return ${returnValueString};
          };
        `.trimIndent();
        }
      )
      .join('\n\n');
    //#endregion

    writeFileSync(
      entityAPIOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports,
          }),
          `
            //#region Endpoint Paths
            ${entityAPIEndpointPathsOutputCode}
            //#endregion
          `.trimIndent(),
          `
            //#region Data Keys
            export const ${dataKeyVariableName} = '${tag.toCamelCase()}';
            //#endregion
          `.trimIndent(),
          `
            //#region API
            ${entityAPIOutputCode}
            //#endregion
          `.trimIndent(),
        ].join('\n\n'),
        {
          filepath: entityAPIOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  });

  const apiAdapterOutputFilePath = `${apiOutputFilePath}/Adapter.ts`;
  writeFileSync(
    apiAdapterOutputFilePath,
    prettier.format(getAPIAdapterCode(), {
      filepath: apiAdapterOutputFilePath,
      ...prettierConfig,
    })
  );

  const apiIndexOutputFilePath = `${apiOutputFilePath}/index.ts`;
  writeFileSync(
    apiIndexOutputFilePath,
    prettier.format(
      [
        ...Object.keys(requestGroupings).map((tag) => {
          return tagToEntityLabelMappings[tag].PascalCaseEntities;
        }),
        'Adapter',
      ]
        .map((PascalCaseEntities) => {
          return `export * from './${PascalCaseEntities}';`;
        })
        .join('\n'),
      {
        filepath: apiIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write index output file
  const indexOutputFilePath = `${outputRootPath}/index.ts`;
  writeFileSync(
    indexOutputFilePath,
    prettier.format(
      ['api', 'models']
        .map((folderName) => {
          return `export * from './${folderName}';`;
        })
        .join('\n'),
      {
        filepath: indexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write debug output files
  if (outputInternalState) {
    ensureDirSync(outputRootPath);
    writeFileSync(
      `${outputRootPath}/request-groupings.output.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/tag-entity-label-mappings.output.json`,
      JSON.stringify(tagToEntityLabelMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-references.output.json`,
      JSON.stringify(schemaEntityReferences, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-to-entity-mappings.output.json`,
      JSON.stringify(schemaToEntityMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-groupings.output.json`,
      JSON.stringify(entitySchemaGroups, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/validation-schemas.output.json`,
      JSON.stringify(models, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/models-to-validation-schema-mappings.output.json`,
      JSON.stringify(modelsToValidationSchemaMappings, null, 2)
    );
  }
  //#endregion
};

export interface GetImportsCodeOptions {
  imports?: Record<string, string[]>;
}
export const getImportsCode = ({ imports }: GetImportsCodeOptions) => {
  if (imports) {
    return Object.keys(imports!).map((importFilePath) => {
      const importNames = imports![importFilePath];
      return `import { ${importNames.join(', ')} } from '${importFilePath}';`;
    });
  }
  return [];
};
