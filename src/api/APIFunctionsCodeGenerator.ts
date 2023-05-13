import { cloneDeep } from 'lodash';

import {
  API_ADAPTER_PATH,
  BINARY_RESPONSE_TYPES,
  GeneratedSchemaCodeConfiguration,
  ModuleImports,
  PATHS_LIBRARY_PATH,
  RequestGroupings,
  TagNameToEntityLabelsMap,
} from '../models/TypescriptAPIGenerator';

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
                  if (!imports[PATHS_LIBRARY_PATH]) {
                    imports[PATHS_LIBRARY_PATH] = [];
                  }
                  if (
                    !imports[PATHS_LIBRARY_PATH].includes(`getInterpolatedPath`)
                  ) {
                    imports[PATHS_LIBRARY_PATH].push(`getInterpolatedPath`);
                  }
                  return `getInterpolatedPath(${endpointPathName}, {
                  ${pathParameters.map(({ name }) => name).join(',\n')}
                })`;
                }
                return endpointPathName;
              })();

              if (queryParameters && queryParameters.length > 0) {
                if (!imports[PATHS_LIBRARY_PATH]) {
                  imports[PATHS_LIBRARY_PATH] = [];
                }
                if (!imports[PATHS_LIBRARY_PATH].includes(`addSearchParams`)) {
                  imports[PATHS_LIBRARY_PATH].push(`addSearchParams`);
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
