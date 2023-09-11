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
   * The prefix to add to the controller names.
   */
  tsedControllerNamePrefix?: string;

  /**
   * The suffix to add to the controller names.
   */
  tsedControllerNameSuffix?: string;

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
  tsedControllerNamePrefix,
  tsedControllerNameSuffix,
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
          requestPath,
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

        const {
          controllerMethodDecorators,
          controllerMethodParametersCode,
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

          //#region Controller Method parameters code
          const controllerMethodParametersCode = [
            //#region Path parameters
            ...(() => {
              if (pathParameters) {
                addModuleImport({
                  imports,
                  importName: 'PathParams',
                  importFilePath: TSED_COMMON_LIBRARY_PATH,
                });
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
                  return `@PathParams('${name}') ${name}: ${type}`;
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

                  return [
                    `@BodyParams() requestPayload: ${requestBodySchemaName}`,
                  ];
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

                return [
                  `@QueryParams() queryParams: ${queryParametersModelReference}`,
                ];
              }
              return [];
            })(),
            //#endregion
          ].join(', ');
          //#endregion

          if (successResponseSchemas && successResponseSchemas.length > 0) {
            successResponseSchemas.forEach((successResponseSchema) => {
              const { httpStatusCode, description } = successResponseSchema;
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
                    }`,
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
                      })()
                  );
                }
              }
              if ('type' in successResponseSchema) {
                controllerMethodDecorators.push(
                  `@Returns(${httpStatusCode}, ${
                    (primitiveTypeToModelMapping as any)[
                      successResponseSchema.type
                    ] || successResponseSchema.type
                  })` +
                    (() => {
                      if (description) {
                        return `.Description(${JSON.stringify(description)})`;
                      }
                      return '';
                    })()
                );
              }
            });
          }

          //#region API function call arguments code
          const apiFunctionCallArgumentsCode = [
            //#region Path parameters
            ...(() => {
              if (pathParameters) {
                return pathParameters.map(({ name }) => {
                  return name;
                });
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
