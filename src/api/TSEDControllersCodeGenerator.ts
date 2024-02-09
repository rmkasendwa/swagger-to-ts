import { cloneDeep } from 'lodash';

import {
  ENVIRONMENT_DEFINED_MODELS,
  OpenAPISpecification,
  RequestGroupings,
  TSEDControllersCodeConfiguration,
  TSED_COMMON_LIBRARY_PATH,
  TSED_DEPENDENCY_INJECTION_LIBRARY_PATH,
  TSED_SCHEMA_LIBRARY_PATH,
  TSED_SWAGGER_LIBRARY_PATH,
  TagNameToEntityLabelsMap,
  primitiveTypeToModelMapping,
} from '../models';
import { getPrimitiveSchemaType } from './SchemaGenerator';
import { addModuleImport } from './Utils';

//#region API functions code generator
export interface GenerateTSEDControllersCodeConfigurationOptions {
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
   * The path to the tsed authenticate decorator import.
   */
  authenticateDecoratorImportPath?: string;

  /**
   * The path to the tsed authorize decorator import.
   */
  authorizeDecoratorImportPath?: string;

  /**
   * The prefix to add to the controller names.
   */
  tsedControllerNamePrefix?: string;

  /**
   * The suffix to add to the controller names.
   */
  tsedControllerNameSuffix?: string;

  /**
   * Whether to propagate request headers to the API function calls.
   */
  propagateRequestHeaders?: boolean;

  /**
   * The OpenAPI specification.
   */
  openAPISpecification: OpenAPISpecification;
}
export const getTSEDControllersCodeConfiguration = ({
  requestGroupings,
  tagToEntityLabelMappings,
  schemaToEntityMappings,
  authenticateDecoratorImportPath,
  authorizeDecoratorImportPath,
  tsedControllerNamePrefix,
  tsedControllerNameSuffix,
  propagateRequestHeaders = false,
  openAPISpecification,
}: GenerateTSEDControllersCodeConfigurationOptions) => {
  return Object.keys(requestGroupings).reduce((accumulator, tag) => {
    const imports = cloneDeep(requestGroupings[tag].imports);

    //#region Generate entity api request functions
    const controllerMethodsCode = requestGroupings[tag].requests
      .map((request) => {
        const {
          method,
          operationName,
          description,
          requestPath: baseRequestPath,
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
          summary,
        } = request;

        const streamAPIResponse =
          request['x-requestConfig']?.tsedControllerConfig?.streamAPIResponse;
        const responseHeaders =
          request['x-requestConfig']?.tsedControllerConfig?.responseHeaders;
        const permissions =
          request['x-requestConfig']?.tsedControllerConfig?.permissions;
        const userDefinedRequestPath =
          request['x-requestConfig']?.tsedControllerConfig?.path;
        const requestPath = userDefinedRequestPath ?? baseRequestPath;

        const {
          controllerMethodDecorators,
          controllerMethodParametersCode,
          responseHeadersCode,
          apiFunctionCallArgumentsCode,
        } = (() => {
          const controllerMethodRequestMethodName = method.toPascalCase();
          const controllerRequestPath = requestPath
            .replace(/(\/api\b|\/v\d+\b)/g, '')
            .replace(
              new RegExp(
                `\\/${tagToEntityLabelMappings[tag]['kebab-case-entities']}\\b`,
                'g'
              ),
              ''
            )
            .replace(/\{(\w+?)\}/g, ':$1');

          const controllerMethodDecorators: string[] = [
            controllerRequestPath.length > 0
              ? `@${controllerMethodRequestMethodName}('${controllerRequestPath}')`
              : `@${controllerMethodRequestMethodName}()`,
          ];

          addModuleImport({
            imports,
            importName: controllerMethodRequestMethodName,
            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
          });

          if (
            authorizeDecoratorImportPath &&
            permissions &&
            permissions.length > 0
          ) {
            const permissionsVariableNames = permissions.map(
              (permissionCode) => {
                return `${permissionCode
                  .replace(/\W+/g, '_')
                  .toUpperCase()}_PERMISSION`;
              }
            );
            permissionsVariableNames.forEach((permissionsVariableName) => {
              addModuleImport({
                imports,
                importName: permissionsVariableName,
                importFilePath: '../permissions',
              });
            });
            controllerMethodDecorators.push(
              `@Authorize(${permissionsVariableNames.join(', ')})`
            );
            addModuleImport({
              imports,
              importName: 'Authorize',
              importFilePath: authorizeDecoratorImportPath,
            });
          }

          if (summary) {
            addModuleImport({
              imports,
              importName: 'Summary',
              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
            });
            controllerMethodDecorators.push(`@Summary('${summary}')`, '');
          }

          if (description) {
            addModuleImport({
              imports,
              importName: 'Description',
              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
            });
            controllerMethodDecorators.push(
              `@Description(${JSON.stringify(description)})`,
              ''
            );
          }

          if (propagateRequestHeaders || responseHeaders) {
            addModuleImport({
              imports,
              importName: 'Context',
              importFilePath: TSED_COMMON_LIBRARY_PATH,
            });
          }

          //#region Controller Method parameters code
          const controllerMethodParametersCode = [
            //#region Path parameters
            ...(() => {
              if (pathParameters?.length) {
                addModuleImport({
                  imports,
                  importName: 'PathParams',
                  importFilePath: TSED_COMMON_LIBRARY_PATH,
                });
                return pathParameters.map(({ name, schema, description }) => {
                  const decorators = [`@PathParams('${name}')`];
                  if (description) {
                    decorators.push(
                      `@Description(${JSON.stringify(description)})`
                    );
                    addModuleImport({
                      imports,
                      importName: 'Description',
                      importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                    });
                  }
                  if ('enum' in schema && schema.enum?.length) {
                    decorators.push(
                      `@Enum(${schema.enum
                        .filter((value) => value.length > 0)
                        .map((value) => `'${value}'`)
                        .join(', ')})`
                    );
                    addModuleImport({
                      imports,
                      importName: 'Enum',
                      importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                    });
                  }
                  return `${decorators.join(
                    ' '
                  )} ${name}: ${getPrimitiveSchemaType(schema)}`;
                });
              }
              return [];
            })(),
            //#endregion

            //#region Request body parameters
            ...(() => {
              if (requestBody && (requestBodySchemaName || requestBodyType)) {
                addModuleImport({
                  imports,
                  importName: 'BodyParams',
                  importFilePath: TSED_COMMON_LIBRARY_PATH,
                });

                if (requestBodySchemaName) {
                  const schemaSource = `../models/${
                    tagToEntityLabelMappings[
                      schemaToEntityMappings[requestBodySchemaName]
                    ].PascalCaseEntities
                  }`.trim();

                  addModuleImport({
                    imports,
                    importName: requestBodySchemaName,
                    importFilePath: schemaSource,
                  });

                  return [
                    `@BodyParams() requestPayload: ${requestBodySchemaName}`,
                  ];
                }

                if (requestBodyType) {
                  if (requestBodyTypeDependentSchemaName) {
                    const schemaSource = `../models/${
                      tagToEntityLabelMappings[
                        schemaToEntityMappings[
                          requestBodyTypeDependentSchemaName
                        ]
                      ].PascalCaseEntities
                    }`.trim();

                    addModuleImport({
                      imports,
                      importName: requestBodyTypeDependentSchemaName,
                      importFilePath: schemaSource,
                    });
                  }
                  return [`@BodyParams() requestPayload: ${requestBodyType}`];
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
                addModuleImport({
                  imports,
                  importName: 'HeaderParams',
                  importFilePath: TSED_COMMON_LIBRARY_PATH,
                });
                const schemaSource = `../models/${
                  tagToEntityLabelMappings[
                    schemaToEntityMappings[headerParametersModelReference]
                  ].PascalCaseEntities
                }`.trim();

                addModuleImport({
                  imports,
                  importName: headerParametersModelReference,
                  importFilePath: schemaSource,
                });

                return [
                  `@HeaderParams() headers: ${headerParametersModelReference}`,
                ];
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
                addModuleImport({
                  imports,
                  importName: 'QueryParams',
                  importFilePath: TSED_COMMON_LIBRARY_PATH,
                });
                const schemaSource = `../models/${
                  tagToEntityLabelMappings[
                    schemaToEntityMappings[queryParametersModelReference]
                  ].PascalCaseEntities
                }`.trim();

                addModuleImport({
                  imports,
                  importName: queryParametersModelReference,
                  importFilePath: schemaSource,
                });

                return [
                  `@QueryParams() queryParams: ${queryParametersModelReference}`,
                ];
              }
              return [];
            })(),
            //#endregion

            //#region Context
            ...(() => {
              if (propagateRequestHeaders || responseHeaders) {
                return [`@Context() ctx: Context`];
              }
              return [];
            })(),
            //#endregion
          ].join(', ');
          //#endregion

          //#region Success response schemas
          if (successResponseSchemas && successResponseSchemas.length > 0) {
            successResponseSchemas.forEach((successResponseSchema) => {
              const { httpStatusCode, description, contentType } =
                successResponseSchema;
              addModuleImport({
                imports,
                importName: 'Returns',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
              if ('name' in successResponseSchema) {
                const { name, isArray } = successResponseSchema;

                if (!ENVIRONMENT_DEFINED_MODELS.includes(name as any)) {
                  addModuleImport({
                    imports,
                    importName: name,
                    importFilePath: `../models/${
                      tagToEntityLabelMappings[schemaToEntityMappings[name]]
                        .PascalCaseEntities
                    }`.trim(),
                  });
                }

                if (isArray) {
                  controllerMethodDecorators.push(
                    `@Returns(${httpStatusCode}, Array).Of(${name})` +
                      (() => {
                        if (description) {
                          return `.Description(${JSON.stringify(description)})`;
                        }
                        return '';
                      })()
                  );
                } else {
                  controllerMethodDecorators.push(
                    `@Returns(${httpStatusCode}, ${name})` +
                      (() => {
                        if (description) {
                          return `.Description(${JSON.stringify(description)})`;
                        }
                        return '';
                      })() +
                      (() => {
                        if (contentType) {
                          return `.ContentType(${JSON.stringify(contentType)})`;
                        }
                      })()
                  );
                }
              }
              if ('type' in successResponseSchema) {
                const { type } = successResponseSchema;
                const typeModel = (primitiveTypeToModelMapping as any)[type];
                let returnTypeDecorator = typeModel
                  ? `@Returns(${httpStatusCode}, ${typeModel})`
                  : `@Returns(${httpStatusCode})`;

                if (description) {
                  returnTypeDecorator += `.Description(${JSON.stringify(
                    description
                  )})`;
                }
                if (contentType) {
                  returnTypeDecorator += `.ContentType(${JSON.stringify(
                    contentType
                  )})`;
                }
                controllerMethodDecorators.push(returnTypeDecorator);
              }
            });
          }
          //#endregion

          //#region Response headers code
          const responseHeadersCode = (() => {
            if (responseHeaders) {
              return `ctx.response.setHeaders(${JSON.stringify(
                responseHeaders,
                null,
                2
              )});`;
            }
            return '';
          })();
          //#endregion

          //#region API function call arguments code
          const apiFunctionCallArgumentsCode = [
            //#region Path parameters
            ...(() => {
              if (pathParameters?.length) {
                return pathParameters.map(({ name }) => name);
              }
              return [];
            })(),
            //#endregion

            //#region Request body parameters
            ...(() => {
              if (requestBody && (requestBodySchemaName || requestBodyType)) {
                return ['requestPayload'];
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
                return ['headers'];
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
                return [`queryParams`];
              }
              return [];
            })(),
            //#endregion

            //#region Request options
            ...(() => {
              if (propagateRequestHeaders) {
                if (streamAPIResponse) {
                  return [
                    `{
                      unWrapResponse: false,
                      responseType: 'stream',
                      headers: (() => {
                        const headers = { ...ctx.request.headers };
                        ['origin', 'host', 'content-length'].forEach((headerKey) => {
                          delete headers[headerKey];
                        });
                        return headers;
                      })(),
                    }`,
                  ];
                }
                return [
                  `
                    {
                      headers: (() => {
                        const headers = { ...ctx.request.headers };
                        ['origin', 'host', 'content-length'].forEach((headerKey) => {
                          delete headers[headerKey];
                        });
                        return headers;
                      })(),
                    }
                  `.trimIndent(),
                ];
              }
              if (streamAPIResponse) {
                return [
                  `{
                    unWrapResponse: false,
                    responseType: 'stream'
                  }`,
                ];
              }
              return [];
            })(),
            //#endregion
          ].join(', ');
          //#endregion

          return {
            controllerMethodDecorators: (() => {
              if (controllerMethodDecorators.length > 0) {
                return controllerMethodDecorators.join('\n');
              }
              return '';
            })(),
            controllerMethodParametersCode,
            apiFunctionCallArgumentsCode,
            responseHeadersCode,
          };
        })();

        addModuleImport({
          imports,
          importName: operationName,
          importFilePath: '../api',
        });

        return `
          ${controllerMethodDecorators}
          async ${operationName}(${controllerMethodParametersCode}) {
            ${responseHeadersCode}
            return ${operationName}(${apiFunctionCallArgumentsCode});
          }
        `.trimIndent();
      })
      .join('\n\n');
    //#endregion

    addModuleImport({
      imports,
      importName: 'Controller',
      importFilePath: TSED_DEPENDENCY_INJECTION_LIBRARY_PATH,
    });
    addModuleImport({
      imports,
      importName: 'Docs',
      importFilePath: TSED_SWAGGER_LIBRARY_PATH,
    });
    addModuleImport({
      imports,
      importName: 'Name',
      importFilePath: TSED_SCHEMA_LIBRARY_PATH,
    });

    let controllerName = tagToEntityLabelMappings[tag]['Entities Label'];

    if (tsedControllerNamePrefix) {
      controllerName = tsedControllerNamePrefix + controllerName;
    }

    if (tsedControllerNameSuffix) {
      controllerName = controllerName + tsedControllerNameSuffix;
    }

    const classDecorators = [
      `@Controller('/${tagToEntityLabelMappings[tag]['kebab-case-entities']}')`,
      `@Docs('api-v1')`,
      `@Name('${controllerName}')`,
    ];

    const classDescription = openAPISpecification.tags.find(
      ({ name }) => name === tag
    )?.description;
    if (classDescription) {
      classDecorators.push(`@Description(${JSON.stringify(classDescription)})`);
      addModuleImport({
        imports,
        importName: 'Description',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }

    if (authenticateDecoratorImportPath) {
      classDecorators.push(`@Authenticate()`);
      addModuleImport({
        imports,
        importName: 'Authenticate',
        importFilePath: authenticateDecoratorImportPath,
      });
    }

    const outputCode = `
        ${classDecorators.join('\n')}
        export class ${
          tagToEntityLabelMappings[tag].PascalCaseEntity
        }Controller {
          ${controllerMethodsCode}
        }
      `.trimIndent();

    accumulator[tag] = {
      outputCode,
      imports,
    };

    return accumulator;
  }, {} as TSEDControllersCodeConfiguration);
};
//#endregion
