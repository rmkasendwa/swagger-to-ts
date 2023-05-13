import { cloneDeep } from 'lodash';

import {
  API_ADAPTER_PATH,
  BINARY_RESPONSE_TYPES,
  GeneratedSchemaCodeConfiguration,
  ModuleImports,
  PATHS_LIBRARY_PATH,
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
export interface GenerateAPIFunctionsCodeConfigurationOptions {
  requestGroupings: RequestGroupings;
  tagToEntityLabelMappings: TagNameToEntityLabelsMap;
  schemaToEntityMappings: Record<string, string>;
  modelsToValidationSchemaMappings: Record<
    string,
    GeneratedSchemaCodeConfiguration
  >;
}
export const getAPIFunctionsCodeConfiguration = ({
  requestGroupings,
  tagToEntityLabelMappings,
  schemaToEntityMappings,
  modelsToValidationSchemaMappings,
}: GenerateAPIFunctionsCodeConfigurationOptions) => {
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
      const apiOutputCode = requestGroupings[tag].requests
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
                    if (requestBody && requestBodySchemaName) {
                      jsDocCommentLines.push(
                        `@param requestPayload ${
                          requestBody.description || ''
                        }`.trim()
                      );

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
                        return [
                          `queryParams: ${queryParametersModelReference}`,
                        ];
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

                if (!imports[API_ADAPTER_PATH].includes('RequestOptions')) {
                  imports[API_ADAPTER_PATH].push('RequestOptions');
                }

                let returnValueString = 'data';

                if (successResponseSchemaName) {
                  const successResponseValidationSchemaName =
                    modelsToValidationSchemaMappings[successResponseSchemaName]
                      .zodValidationSchemaName;
                  const validationSchemaSource = `../models/${
                    tagToEntityLabelMappings[
                      schemaToEntityMappings[successResponseSchemaName]
                    ].PascalCaseEntities
                  }`;

                  addModuleImport({
                    imports,
                    importName: successResponseValidationSchemaName,
                    importFilePath: validationSchemaSource,
                  });

                  returnValueString = `${successResponseValidationSchemaName}.parse(data)`;
                  jsDocCommentLines.push(
                    `@returns ${successResponseSchemaName}`
                  ); // TODO: Replace this with the response description.
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
                      `.trimIndent();
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
              headerParameters && headerParameters.length > 0
                ? '\nheaders,'
                : ''
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

      accumulator[tag] = {
        endpointPathsOutputCode,
        apiOutputCode,
        imports,
        dataKeyVariableName,
      };

      return accumulator;
    },
    {} as Record<
      string,
      {
        endpointPathsOutputCode: string;
        apiOutputCode: string;
        imports: ModuleImports;
        dataKeyVariableName: string;
      }
    >
  );
};
//#endregion
