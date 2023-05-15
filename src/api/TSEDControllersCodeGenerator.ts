import { cloneDeep } from 'lodash';

import {
  GeneratedSchemaCodeConfiguration,
  ModuleImports,
  RequestGroupings,
  TSED_COMMON_LIBRARY_PATH,
  TSED_SCHEMA_LIBRARY_PATH,
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
}: GenerateTSEDControllersCodeConfigurationOptions) => {
  return Object.keys(requestGroupings).reduce(
    (accumulator, tag) => {
      const imports = cloneDeep(requestGroupings[tag].imports);

      //#region Generate entity api request functions
      const controllerMethodsCode = requestGroupings[tag].requests
        .map(
          ({
            method,
            operationName,
            description,
            endpointPath,
            pathParameters,
            headerParameters,
            headerParametersModelReference,
            queryParameters,
            queryParametersModelReference,
            requestBody,
            requestBodySchemaName,
            requestBodyType,
            requestBodyTypeDependentSchemaName,
            summary,
          }) => {
            const {
              controllerMethodDecorators,
              controllerMethodParametersCode,
            } = (() => {
              const controllerMethodRequestMethodName = method.toPascalCase();
              const controllerMethodDecorators: string[] = [
                `@${controllerMethodRequestMethodName}('${endpointPath}')`,
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
                  `@Description('${description}')`,
                  ''
                );
              }

              //#region API function parameters code
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
                  if (
                    requestBody &&
                    (requestBodySchemaName || requestBodyType)
                  ) {
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
                      return [
                        `@BodyParams() requestPayload: ${requestBodyType}`,
                      ];
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

              return {
                controllerMethodDecorators: (() => {
                  if (controllerMethodDecorators.length > 0) {
                    return controllerMethodDecorators.join('\n');
                  }
                  return '';
                })(),
                controllerMethodParametersCode,
              };
            })();
            //#endregion

            addModuleImport({
              imports,
              importName: operationName,
              importFilePath: '../api',
            });

            return `
              ${controllerMethodDecorators}
              async ${operationName}(${controllerMethodParametersCode}) {
                return ${operationName}();
              }
            `.trimIndent();
          }
        )
        .join('\n\n');
      //#endregion

      const outputCode = `
        export class ${tagToEntityLabelMappings[tag].PascalCaseEntity}Controller {
          ${controllerMethodsCode}
        }
      `.trimIndent();

      accumulator[tag] = {
        outputCode,
        imports,
      };

      return accumulator;
    },
    {} as Record<
      string,
      {
        outputCode: string;
        imports: ModuleImports;
      }
    >
  );
};
//#endregion
