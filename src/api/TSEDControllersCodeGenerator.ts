import { cloneDeep } from 'lodash';

import {
  API_ADAPTER_PATH,
  ENVIRONMENT_DEFINED_MODELS,
  GeneratedSchemaCodeConfiguration,
  ModuleImports,
  PATHS_LIBRARY_PATH,
  RequestGroupings,
  TagNameToEntityLabelsMap,
} from '../models';
import { addModuleImport } from './Utils';

//#region API functions code generator
export interface GenerateTSEDControllersCodeConfigurationOptions {
  requestGroupings: RequestGroupings;
  tagToEntityLabelMappings: TagNameToEntityLabelsMap;
  schemaToEntityMappings: Record<string, string>;
  modelsToValidationSchemaMappings: Record<
    string,
    GeneratedSchemaCodeConfiguration
  >;
}
export const getTSEDControllersCodeConfiguration = ({
  requestGroupings,
  tagToEntityLabelMappings,
  schemaToEntityMappings,
  modelsToValidationSchemaMappings,
}: GenerateTSEDControllersCodeConfigurationOptions) => {
  return Object.keys(requestGroupings).reduce(
    (accumulator, tag) => {
      //#region Generate entity api endpoint paths
      const endpointPathsOutputCode = requestGroupings[tag].requests
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
      const imports = cloneDeep(requestGroupings[tag].imports);

      //#region Generate entity api request functions
      const outputCode = requestGroupings[tag].requests
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
            requestBodyType,
            requestBodyTypeDependentSchemaName,
            successResponseSchemaName,
          }) => {
            const {
              jsDocCommentSnippet,
              apiFunctionParametersCode,
              returnValueString,
            } = (() => {
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

              //#region API function parameters code
              const apiFunctionParametersCode = [
                //#region Path parameters
                ...(() => {
                  if (pathParameters) {
                    return pathParameters.map(({ name, schema }) => {
                      const type = (() => {
                        if (
                          'type' in schema &&
                          (
                            [
                              'boolean',
                              'number',
                              'string',
                            ] as (typeof schema.type)[]
                          ).includes(schema.type)
                        ) {
                          return schema.type;
                        }
                        return 'string';
                      })();
                      return `${name}: ${type}`;
                    });
                  }
                  return [];
                })(),
                //#endregion

                //#region Request body parameters
                ...(() => {
                  if (
                    requestBody &&
                    (requestBodySchemaName || requestBodyType)
                  ) {
                    jsDocCommentLines.push(
                      `@param requestPayload ${
                        requestBody.description || ''
                      }`.trim()
                    );

                    if (requestBodySchemaName) {
                      const schemaSource = `
                          ../models/${
                            tagToEntityLabelMappings[
                              schemaToEntityMappings[requestBodySchemaName]
                            ].PascalCaseEntities
                          }
                        `.trimIndent();

                      addModuleImport({
                        imports,
                        importName: requestBodySchemaName,
                        importFilePath: schemaSource,
                      });

                      return [`requestPayload: ${requestBodySchemaName}`];
                    }

                    if (requestBodyType) {
                      if (requestBodyTypeDependentSchemaName) {
                        const schemaSource = `
                      ../models/${
                        tagToEntityLabelMappings[
                          schemaToEntityMappings[
                            requestBodyTypeDependentSchemaName
                          ]
                        ].PascalCaseEntities
                      }
                    `.trimIndent();

                        addModuleImport({
                          imports,
                          importName: requestBodyTypeDependentSchemaName,
                          importFilePath: schemaSource,
                        });
                      }
                      return [`requestPayload: ${requestBodyType}`];
                    }
                  }
                  return [];
                })(),
                //#endregion

                //#region Header parameters
                ...(() => {
                  if (
                    headerParametersModelReference &&
                    headerParameters &&
                    headerParameters.length > 0
                  ) {
                    jsDocCommentLines.push(`@param headers`);

                    const schemaSource = `
                        ../models/${
                          tagToEntityLabelMappings[
                            schemaToEntityMappings[
                              headerParametersModelReference
                            ]
                          ].PascalCaseEntities
                        }
                      `.trimIndent();

                    addModuleImport({
                      imports,
                      importName: headerParametersModelReference,
                      importFilePath: schemaSource,
                    });

                    return [`headers: ${headerParametersModelReference}`];
                  }
                  return [];
                })(),
                //#endregion

                //#region Query parameters
                ...(() => {
                  if (
                    queryParametersModelReference &&
                    queryParameters &&
                    queryParameters.length > 0
                  ) {
                    jsDocCommentLines.push(`@param queryParams`);

                    const schemaSource = `
                        ../models/${
                          tagToEntityLabelMappings[
                            schemaToEntityMappings[
                              queryParametersModelReference
                            ]
                          ].PascalCaseEntities
                        }
                      `.trimIndent();

                    addModuleImport({
                      imports,
                      importName: queryParametersModelReference,
                      importFilePath: schemaSource,
                    });

                    // Check if query params are required
                    if (
                      queryParameters.filter(({ required }) => required)
                        .length > 0
                    ) {
                      return [`queryParams: ${queryParametersModelReference}`];
                    }

                    return [
                      `queryParams: ${queryParametersModelReference} = {}`,
                    ];
                  }
                  return [];
                })(),
                //#endregion

                `{ ...rest }: RequestOptions = {}`,
              ].join(', ');
              //#endregion

              addModuleImport({
                imports,
                importName: 'RequestOptions',
                importFilePath: API_ADAPTER_PATH,
              });

              const returnValueString = (() => {
                if (
                  successResponseSchemaName &&
                  modelsToValidationSchemaMappings[successResponseSchemaName]
                ) {
                  const successResponseValidationSchemaName =
                    modelsToValidationSchemaMappings[successResponseSchemaName]
                      .zodValidationSchemaName;
                  const validationSchemaSource = `
                      ../models/${
                        tagToEntityLabelMappings[
                          schemaToEntityMappings[successResponseSchemaName]
                        ].PascalCaseEntities
                      }
                    `.trimIndent();

                  addModuleImport({
                    imports,
                    importName: successResponseValidationSchemaName,
                    importFilePath: validationSchemaSource,
                  });

                  jsDocCommentLines.push(
                    `@returns ${successResponseSchemaName}`
                  ); // TODO: Replace this with the response description.
                  return `${successResponseValidationSchemaName}.parse(data)`;
                }
                return 'data';
              })();

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
                      `.trimIndent();
                  }
                  return '';
                })(),
                apiFunctionParametersCode,
                returnValueString,
              };
            })();

            //#region API request URL code
            const interpolatedEndpointPathString = (() => {
              const interpolatedEndpointPathString = (() => {
                if (pathParameters && pathParameters.length > 0) {
                  const interpolationFunctionName = 'getInterpolatedPath';
                  addModuleImport({
                    imports,
                    importName: interpolationFunctionName,
                    importFilePath: PATHS_LIBRARY_PATH,
                  });
                  return `
                    ${interpolationFunctionName}(${endpointPathName}, {
                      ${pathParameters.map(({ name }) => name).join(',\n')}
                    })
                  `;
                }
                return endpointPathName;
              })();

              if (queryParameters && queryParameters.length > 0) {
                const searchParamsFunctionName = 'addSearchParams';
                addModuleImport({
                  imports,
                  importName: searchParamsFunctionName,
                  importFilePath: PATHS_LIBRARY_PATH,
                });
                return `
                  ${searchParamsFunctionName}(${interpolatedEndpointPathString},
                    {...queryParams}, {
                    arrayParamStyle: 'append'
                  })
                `.trimIndent();
              }
              return interpolatedEndpointPathString;
            })();
            //#endregion

            //#region API adapter request call code
            let httpActionName = (() => {
              if (method === 'delete') {
                return `_delete`;
              }
              return method;
            })();

            addModuleImport({
              imports,
              importName: httpActionName,
              importFilePath: API_ADAPTER_PATH,
            });

            const isEnvironmentDefinedModel = Boolean(
              successResponseSchemaName &&
                ENVIRONMENT_DEFINED_MODELS.includes(
                  successResponseSchemaName as any
                )
            );

            if (isEnvironmentDefinedModel) {
              httpActionName += `<${successResponseSchemaName}>`;
            }
            //#endregion

            const requestOptionsCode = [
              `label: '${operationDescription}'`,
              ...(() => {
                if (headerParameters && headerParameters.length > 0) {
                  return [`headers`];
                }
                return [];
              })(),
              ...(() => {
                if (requestBody) {
                  return [`data: requestPayload`];
                }
                return [];
              })(),
              ...(() => {
                if (method.match(/get/gi)) {
                  return [`cacheId: ${dataKeyVariableName}`];
                }
                return [];
              })(),
              ...(() => {
                if (isEnvironmentDefinedModel) {
                  return [`responseType: 'blob'`];
                }
                return [];
              })(),
              '...rest',
            ].join(',\n');

            return `
              ${jsDocCommentSnippet}
              export const ${operationName} = async (${apiFunctionParametersCode}) => {
                const { data } = await ${httpActionName}(${interpolatedEndpointPathString}, {
                  ${requestOptionsCode}
                });
                return ${returnValueString};
              };
            `.trimIndent();
          }
        )
        .join('\n\n');
      //#endregion

      accumulator[tag] = {
        endpointPathsOutputCode,
        outputCode,
        imports,
        dataKeyVariableName,
      };

      return accumulator;
    },
    {} as Record<
      string,
      {
        endpointPathsOutputCode: string;
        outputCode: string;
        imports: ModuleImports;
        dataKeyVariableName: string;
      }
    >
  );
};
//#endregion
