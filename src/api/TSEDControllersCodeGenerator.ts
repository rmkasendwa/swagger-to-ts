import { cloneDeep } from 'lodash';

import {
  GeneratedSchemaCodeConfiguration,
  ModuleImports,
  RequestGroupings,
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
            const { controllerMethodDecorators, apiFunctionParametersCode } =
              (() => {
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
                //#endregion

                return {
                  controllerMethodDecorators: (() => {
                    if (controllerMethodDecorators.length > 0) {
                      return controllerMethodDecorators.join('\n');
                    }
                    return '';
                  })(),
                  apiFunctionParametersCode,
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
              async ${operationName}(${apiFunctionParametersCode}) {
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
