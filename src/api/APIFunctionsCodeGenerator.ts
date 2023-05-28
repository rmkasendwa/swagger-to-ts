import { cloneDeep } from 'lodash';

import {
  APIFunctionsCodeConfiguration,
  ENVIRONMENT_DEFINED_MODELS,
  GeneratedSchemaCodeConfiguration,
  PATHS_LIBRARY_PATH,
  RMK_UTILS_LIBRARY_PATH,
  RequestGroupings,
  TagNameToEntityLabelsMap,
} from '../models';
import { addModuleImport } from './Utils';

//#region API adapter code generator
export const getAPIAdapterCode = () => {
  return `
    import { getAPIAdapter } from '@infinite-debugger/axios-api-adapter';

    declare module '@infinite-debugger/axios-api-adapter' {
      interface IAPIAdapterConfiguration {
        API_KEY?: string;
      }
    }

    export {
      IAPIAdapterConfiguration,
      REDIRECTION_ERROR_MESSAGES,
      RequestOptions,
      ResponseProcessor,
    } from '@infinite-debugger/axios-api-adapter';

    export {
      APIAdapterConfiguration,
      RequestController,
      _delete,
      defaultRequestHeaders,
      get,
      logout,
      patch,
      patchDefaultRequestHeaders,
      post,
      put,
    };

    const {
      APIAdapterConfiguration,
      RequestController,
      _delete,
      defaultRequestHeaders,
      get,
      logout,
      patch,
      patchDefaultRequestHeaders,
      post,
      put,
    } = getAPIAdapter({
      id: 'api-client',
    });
  `.trimIndent();
};
//#endregion

//#region API functions code generator
const API_ADAPTER_PATH = `./Adapter`;

export interface GenerateAPIFunctionsCodeConfigurationOptions {
  /**
   * The request groupings to generate code for.
   */
  requestGroupings: RequestGroupings;

  /**
   * The tag to entity label mappings.
   */
  tagToEntityLabelMappings: TagNameToEntityLabelsMap;

  /**
   * The schema to entity mappings.
   */
  schemaToEntityMappings: Record<string, string>;

  /**
   * The models to validation schema mappings.
   */
  modelsToValidationSchemaMappings: Record<
    string,
    GeneratedSchemaCodeConfiguration
  >;

  /**
   * Whether or not to trim null values from responses.
   */
  trimNullValuesFromResponses?: boolean;
}
export const getAPIFunctionsCodeConfiguration = ({
  requestGroupings,
  tagToEntityLabelMappings,
  schemaToEntityMappings,
  modelsToValidationSchemaMappings,
  trimNullValuesFromResponses = true,
}: GenerateAPIFunctionsCodeConfigurationOptions) => {
  return Object.keys(requestGroupings).reduce((accumulator, tag) => {
    const dataKeyVariableName = `${tagToEntityLabelMappings[tag].UPPER_CASE_ENTITIES}_DATA_KEY`;
    const imports = cloneDeep(requestGroupings[tag].imports);
    const exports: string[] = [];

    //#region Generate entity api endpoint paths
    const requestPathsOutputCode = requestGroupings[tag].requests
      .map(({ requestPath, requestPathName, pathParameters }) => {
        if (pathParameters && pathParameters.length > 0) {
          const parametersCode = pathParameters
            .reduce((accumulator, { name }) => {
              accumulator.push(`${name}: string`);
              return accumulator;
            }, [] as string[])
            .join(';\n');
          const pathParamType = `TemplatePath`;
          addModuleImport({
            imports,
            importName: pathParamType,
            importFilePath: PATHS_LIBRARY_PATH,
          });
          return `export const ${requestPathName}: ${pathParamType}<{${parametersCode}}> = '${requestPath}';`;
        }
        return `export const ${requestPathName} = '${requestPath}';`;
      })
      .join('\n');
    //#endregion

    //#region Generate entity api request functions
    const outputCode = requestGroupings[tag].requests
      .map(
        ({
          method,
          operationName,
          requestPathName,
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
          successResponseSchemas,
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
                if (requestBody && (requestBodySchemaName || requestBodyType)) {
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
                    queryParameters.filter(({ required }) => required).length >
                    0
                  ) {
                    return [`queryParams: ${queryParametersModelReference}`];
                  }

                  return [`queryParams: ${queryParametersModelReference} = {}`];
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
              if (successResponseSchemas && successResponseSchemas.length > 0) {
                const [successResponseSchema] = successResponseSchemas;
                if (
                  'name' in successResponseSchema &&
                  modelsToValidationSchemaMappings[successResponseSchema.name]
                ) {
                  const {
                    name: successResponseSchemaName,
                    description,
                    isArray,
                  } = successResponseSchema;
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

                  if (trimNullValuesFromResponses) {
                    addModuleImport({
                      imports,
                      importName: 'removeNullValues',
                      importFilePath: RMK_UTILS_LIBRARY_PATH,
                    });
                  }

                  jsDocCommentLines.push(`@returns ${description}`);
                  if (isArray) {
                    addModuleImport({
                      imports,
                      importName: 'z',
                      importFilePath: 'zod',
                    });
                    if (trimNullValuesFromResponses) {
                      return `z.array(${successResponseValidationSchemaName}).parse(removeNullValues(data))`;
                    }
                    return `z.array(${successResponseValidationSchemaName}).parse(data)`;
                  }
                  if (trimNullValuesFromResponses) {
                    return `${successResponseValidationSchemaName}.parse(removeNullValues(data))`;
                  }
                  return `${successResponseValidationSchemaName}.parse(data)`;
                }
              }
              if (trimNullValuesFromResponses) {
                return 'removeNullValues(data)';
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
                    ${interpolationFunctionName}(${requestPathName}, {
                      ${pathParameters.map(({ name }) => name).join(',\n')}
                    })
                  `;
              }
              return requestPathName;
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
            successResponseSchemas &&
              successResponseSchemas.every((successResponseSchema) => {
                if ('name' in successResponseSchema) {
                  return (
                    successResponseSchema.name &&
                    ENVIRONMENT_DEFINED_MODELS.includes(
                      successResponseSchema.name as any
                    )
                  );
                }
                return 'type' in successResponseSchema;
              })
          );

          if (isEnvironmentDefinedModel && successResponseSchemas) {
            const responseType = `${successResponseSchemas
              .map((successResponseSchema) => {
                if ('name' in successResponseSchema) {
                  return successResponseSchema.name;
                }
                if ('type' in successResponseSchema) {
                  return successResponseSchema.type;
                }
              })
              .join('|')}`;
            if (responseType.length > 0) {
              httpActionName += `<${responseType}>`;
            }
          }
          //#endregion

          const requestOptionsCode = [
            `label: '${operationDescription}'`,
            ...(() => {
              if (headerParameters && headerParameters.length > 0) {
                return [`headers: { ...headers }`];
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

          exports.push(operationName);

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
      requestPathsOutputCode,
      outputCode,
      imports,
      dataKeyVariableName,
      exports,
    };

    return accumulator;
  }, {} as APIFunctionsCodeConfiguration);
};
//#endregion
