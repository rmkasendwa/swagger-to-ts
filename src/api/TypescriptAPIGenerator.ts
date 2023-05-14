import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';
import { cloneDeep } from 'lodash';
import prettier from 'prettier';

import { OpenAPISpecification } from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  PATHS_LIBRARY_PATH,
  RequestGroupings,
  TagNameToEntityLabelsMap,
} from '../models/TypescriptAPIGenerator';
import {
  getAPIAdapterCode,
  getAPIFunctionsCodeConfiguration,
} from './APIFunctionsCodeGenerator';
import { generateModelMappings } from './ModelCodeGenerator';
import { generateSchemaFromRequestParameters } from './SchemaGenerator';
import { addModuleImport, getImportsCode } from './Utils';

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
                request.responses[successResponse].content
              ) {
                if (
                  'application/json' in
                  request.responses[successResponse].content!
                ) {
                  const successResponseSchemaName = (
                    request.responses[successResponse] as any
                  ).content['application/json'].schema.$ref.replace(
                    '#/components/schemas/',
                    ''
                  );
                  return successResponseSchemaName;
                }
                if (
                  'image/png' in request.responses[successResponse].content!
                ) {
                  return BINARY_RESPONSE_TYPE_MODEL_NAME;
                }
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const pathParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'path'
                );
                if (pathParameters.length > 0) {
                  const pathParamType = `TemplatePath`;
                  addModuleImport({
                    imports,
                    importName: pathParamType,
                    importFilePath: PATHS_LIBRARY_PATH,
                  });
                  return {
                    pathParameters,
                  };
                }
              }
            })(),

            //#region Header parameters
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
                  const headerParametersModelReference = `${pascalCaseOperationName}HeaderParams`;
                  swaggerDocs.components.schemas[
                    headerParametersModelReference
                  ] = generateSchemaFromRequestParameters({
                    requestParameters: headerParameters,
                  });
                  return {
                    headerParameters,
                    headerParametersModelReference,
                  };
                }
              }
            })(),
            //#endregion

            //#region Query parameters
            ...(() => {
              if (request.parameters) {
                const queryParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'query'
                );
                if (queryParameters.length > 0) {
                  const queryParametersModelReference = `${pascalCaseOperationName}QueryParams`;
                  swaggerDocs.components.schemas[
                    queryParametersModelReference
                  ] = generateSchemaFromRequestParameters({
                    requestParameters: queryParameters,
                  });
                  return {
                    queryParameters,
                    queryParametersModelReference,
                  };
                }
              }
            })(),
            //#endregion
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

  //#region Generate API functions code configuration
  const apiFunctionsCodeConfiguration = getAPIFunctionsCodeConfiguration({
    requestGroupings,
    modelsToValidationSchemaMappings,
    schemaToEntityMappings,
    tagToEntityLabelMappings,
  });
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
    writeFileSync(
      `${outputRootPath}/api-functions-code-configuration.output.json`,
      JSON.stringify(apiFunctionsCodeConfiguration, null, 2)
    );
  }
  //#endregion

  //#region Write model output files
  const modelsOutputFilePath = `${outputRootPath}/models`;
  ensureDirSync(modelsOutputFilePath);
  Object.keys(models).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const modelFileName = `${PascalCaseEntities}.ts`;
    const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;

    const entityModelsOutputCode = Object.values(models[tag].models)
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
  Object.keys(apiFunctionsCodeConfiguration).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const apiFileName = `${PascalCaseEntities}.ts`;
    const entityAPIOutputFilePath = `${apiOutputFilePath}/${apiFileName}`;
    const {
      apiOutputCode,
      endpointPathsOutputCode,
      imports,
      dataKeyVariableName,
    } = apiFunctionsCodeConfiguration[tag];

    writeFileSync(
      entityAPIOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports,
          }),
          `
            //#region Endpoint Paths
            ${endpointPathsOutputCode}
            //#endregion
          `.trimIndent(),
          `
            //#region Data Keys
            export const ${dataKeyVariableName} = '${tagToEntityLabelMappings[tag].PascalCaseEntities}';
            //#endregion
          `.trimIndent(),
          `
            //#region API
            ${apiOutputCode}
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
};
