import { ModuleImports, OpenAPISpecification } from '../../models';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  ENVIRONMENT_DEFINED_MODELS,
  GeneratedSchemaCodeConfiguration,
  ModelMappings,
  RequestGroupings,
} from '../../models/TypescriptAPIGenerator';
import { findSchemaReferencedSchemas } from '../SchemaGenerator';
import { addModuleImport } from '../Utils';
import {
  GenerateModelCodeOptions,
  generateModelCode,
} from './ModelCodeGenerator';

//#region Generate model mappings
export interface GenerateModelMappingsOptions
  extends Pick<GenerateModelCodeOptions, 'inferTypeFromValidationSchema'> {
  /**
   * The open api specification to use when looking up schemas
   */
  openAPISpecification: OpenAPISpecification;

  /**
   * The request groupings to use when generating the model mappings
   */
  requestGroupings: RequestGroupings;

  /**
   * Whether to generate code for tsed controllers
   */
  generateTsEDControllers?: boolean;
}

/**
 * Generate model mappings
 *
 * @param options The options to use when generating the model mappings
 * @returns The model mappings
 */
export const generateModelMappings = ({
  requestGroupings,
  openAPISpecification,
  generateTsEDControllers,
  inferTypeFromValidationSchema,
}: GenerateModelMappingsOptions): ModelMappings => {
  //#region Find all Schemas referenced in the requests
  const schemaEntityReferences = Object.entries(requestGroupings).reduce<
    Record<string, string[]>
  >((accumulator, [tagName, { requests }]) => {
    requests.forEach(
      ({
        responses,
        requestBody,
        headerParametersModelReference,
        queryParametersModelReference,
      }) => {
        [
          ...Object.values(responses),
          ...(() => {
            if (requestBody) {
              return [requestBody];
            }
            return [];
          })(),
        ].forEach(({ content }) => {
          if (content) {
            if (content['application/json']?.schema) {
              if ('$ref' in content['application/json'].schema) {
                const schemaReference = content['application/json'].schema.$ref;
                const schemaName = schemaReference.replace(
                  '#/components/schemas/',
                  ''
                );
                [
                  ...findSchemaReferencedSchemas({
                    schemaName,
                    openAPISpecification,
                  }),
                  schemaName,
                ].forEach((schemaName) => {
                  if (!accumulator[schemaName]) {
                    accumulator[schemaName] = [];
                  }
                  if (!accumulator[schemaName].includes(tagName)) {
                    accumulator[schemaName].push(tagName);
                  }
                });
              } else if (
                'type' in content['application/json'].schema &&
                content['application/json'].schema.type === 'array' &&
                content['application/json'].schema.items &&
                '$ref' in content['application/json'].schema.items
              ) {
                const schemaReference =
                  content['application/json'].schema.items.$ref;
                const schemaName = schemaReference.replace(
                  '#/components/schemas/',
                  ''
                );
                [
                  ...findSchemaReferencedSchemas({
                    schemaName,
                    openAPISpecification,
                  }),
                  schemaName,
                ].forEach((schemaName) => {
                  if (!accumulator[schemaName]) {
                    accumulator[schemaName] = [];
                  }
                  if (!accumulator[schemaName].includes(tagName)) {
                    accumulator[schemaName].push(tagName);
                  }
                });
              }
            }

            if ('image/png' in content || 'application/pdf' in content) {
              const schemaName = BINARY_RESPONSE_TYPE_MODEL_NAME;
              if (!accumulator[schemaName]) {
                accumulator[schemaName] = [];
              }
              if (!accumulator[schemaName].includes(tagName)) {
                accumulator[schemaName].push(tagName);
              }
            }
          }
        });

        if (headerParametersModelReference) {
          const schemaName = headerParametersModelReference;
          [
            ...findSchemaReferencedSchemas({
              schemaName,
              openAPISpecification,
            }),
            schemaName,
          ].forEach((schemaName) => {
            if (!accumulator[schemaName]) {
              accumulator[schemaName] = [];
            }
            if (!accumulator[schemaName].includes(tagName)) {
              accumulator[schemaName].push(tagName);
            }
          });
        }

        if (queryParametersModelReference) {
          const schemaName = queryParametersModelReference;
          [
            ...findSchemaReferencedSchemas({
              schemaName,
              openAPISpecification,
            }),
            schemaName,
          ].forEach((schemaName) => {
            if (!accumulator[schemaName]) {
              accumulator[schemaName] = [];
            }
            if (!accumulator[schemaName].includes(tagName)) {
              accumulator[schemaName].push(tagName);
            }
          });
        }
      }
    );
    return accumulator;
  }, {});
  //#endregion

  //#region Generate Schema to entity mappings
  const schemaToEntityMappings = Object.keys(schemaEntityReferences).reduce<
    Record<string, string>
  >((accumulator, schemaName) => {
    if (schemaEntityReferences[schemaName].length === 1) {
      accumulator[schemaName] = schemaEntityReferences[schemaName][0];
    } else {
      accumulator[schemaName] = 'Utils';
    }
    return accumulator;
  }, {});
  //#endregion

  //#region Map schema references to entities
  const entitySchemaGroups = Object.keys(schemaEntityReferences).reduce<
    Record<string, string[]>
  >((accumulator, schemaName) => {
    if (schemaEntityReferences[schemaName].length === 1) {
      schemaEntityReferences[schemaName].forEach((entityName) => {
        if (!accumulator[entityName]) {
          accumulator[entityName] = [];
        }
        accumulator[entityName].push(schemaName);
      });
    } else {
      const utilsEntityName = 'Utils';
      if (!accumulator[utilsEntityName]) {
        accumulator[utilsEntityName] = [];
      }
      accumulator[utilsEntityName].push(schemaName);
    }
    return accumulator;
  }, {});
  //#endregion

  //#region Generate validation schemas code
  const models = Object.keys(entitySchemaGroups)
    .sort()
    .reduce<
      Record<
        string,
        {
          models: Record<string, GeneratedSchemaCodeConfiguration>;
          imports?: ModuleImports;
        }
      >
    >((accumulator, entityName) => {
      entitySchemaGroups[entityName]
        .filter((schemaName) => {
          return !ENVIRONMENT_DEFINED_MODELS.includes(schemaName as any);
        })
        .forEach((schemaName) => {
          if (!accumulator[entityName]) {
            accumulator[entityName] = {
              models: {},
            };
          }
          const modelCodeConfiguration = generateModelCode({
            schemaName,
            openAPISpecification,
            generateTsEDControllers,
            inferTypeFromValidationSchema,
          });

          if (modelCodeConfiguration) {
            const {
              generatedVariables,
              zodValidationSchemaCode,
              referencedSchemas,
              inferedTypeCode,
              zodValidationSchemaName,
              imports,
              tsedModelCode,
              tsedModelName,
            } = modelCodeConfiguration;

            referencedSchemas.forEach((referencedSchemaName) => {
              const referencedSchemaEntityName =
                schemaToEntityMappings[referencedSchemaName];
              if (
                referencedSchemaEntityName &&
                referencedSchemaEntityName != entityName
              ) {
                addModuleImport({
                  imports,
                  importName: `${referencedSchemaName}ValidationSchema`,
                  importFilePath: `./${referencedSchemaEntityName}`,
                });

                if (generateTsEDControllers || !inferTypeFromValidationSchema) {
                  addModuleImport({
                    imports,
                    importName: referencedSchemaName,
                    importFilePath: `./${referencedSchemaEntityName}`,
                  });
                }
              }
            });

            accumulator[entityName].models[schemaName] = {
              name: schemaName,
              zodValidationSchemaCode,
              zodValidationSchemaName,
              inferedTypeCode,
              generatedVariables,
              imports,
              tsedModelCode,
              tsedModelName,
              ...(() => {
                if (referencedSchemas.length > 0) {
                  return {
                    referencedSchemas,
                  };
                }
              })(),
            };

            if (imports) {
              if (!accumulator[entityName].imports) {
                accumulator[entityName].imports = {};
              }
              Object.keys(imports).forEach((importFilePath) => {
                imports[importFilePath].forEach((importName) => {
                  addModuleImport({
                    imports: accumulator[entityName].imports!,
                    importName: importName,
                    importFilePath,
                  });
                });
              });
            }
          }
        });

      //#region Sort models by dependency on eath other
      if (accumulator[entityName]?.models) {
        accumulator[entityName].models = (() => {
          const models = accumulator[entityName].models;
          const modelKeys = Object.keys(models);
          const modelsReferencingModelsInSameFile = modelKeys.filter(
            (modelKey) => {
              const model = models[modelKey];
              return model.referencedSchemas?.some((referencedSchema) => {
                return modelKeys.includes(referencedSchema);
              });
            }
          );

          return modelKeys
            .sort((aKey, bKey) => {
              if (
                (modelsReferencingModelsInSameFile.includes(aKey) &&
                  !modelsReferencingModelsInSameFile.includes(bKey)) ||
                models[aKey].referencedSchemas?.some((referencedSchema) => {
                  return referencedSchema === bKey;
                })
              ) {
                return 1;
              }
              if (
                (!modelsReferencingModelsInSameFile.includes(aKey) &&
                  modelsReferencingModelsInSameFile.includes(bKey)) ||
                models[bKey].referencedSchemas?.some((referencedSchema) => {
                  return referencedSchema === aKey;
                })
              ) {
                return -1;
              }
              return 0;
            })
            .reduce((accumulator, modelKey) => {
              accumulator[modelKey] = models[modelKey];
              return accumulator;
            }, {} as Record<string, GeneratedSchemaCodeConfiguration>);
        })();
      }
      //#endregion

      return accumulator;
    }, {});
  //#endregion

  //#region Generate models to validation schema mappings
  const modelsToValidationSchemaMappings = Object.entries(models).reduce<
    Record<string, GeneratedSchemaCodeConfiguration>
  >((accumulator, [, { models }]) => {
    Object.entries(models).forEach(([schemaName, model]) => {
      accumulator[schemaName] = model;
    });
    return accumulator;
  }, {});
  //#endregion

  return {
    entitySchemaGroups,
    schemaToEntityMappings,
    schemaEntityReferences,
    models,
    modelsToValidationSchemaMappings,
  };
};
//#endregion
