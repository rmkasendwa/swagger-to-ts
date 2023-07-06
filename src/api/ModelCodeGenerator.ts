import { isEmpty } from 'lodash';
import { singular } from 'pluralize';

import { ModuleImports, OpenAPISpecification } from '../models';
import {
  SchemaProperty,
  UnionSchemaProperty,
} from '../models/OpenAPISpecification/Schema';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  ENVIRONMENT_DEFINED_MODELS,
  GeneratedSchemaCodeConfiguration,
  ModelMappings,
  RequestGroupings,
  TSED_SCHEMA_LIBRARY_PATH,
  TsedModelProperty,
  ZodValidationSchemaProperty,
} from '../models/TypescriptAPIGenerator';
import { findSchemaReferencedSchemas } from './SchemaGenerator';
import { addModuleImport } from './Utils';

//#region Generate model mappings
export interface GenerateModelMappingsOptions
  extends Pick<GenerateModelCodeOptions, 'inferTypeFromValidationSchema'> {
  openAPISpecification: OpenAPISpecification;
  requestGroupings: RequestGroupings;
  generateTsEDControllers?: boolean;
}

export const generateModelMappings = ({
  requestGroupings,
  openAPISpecification,
  generateTsEDControllers,
  inferTypeFromValidationSchema,
}: GenerateModelMappingsOptions): ModelMappings => {
  //#region Find all Schemas referenced in the requests
  const schemaEntityReferences = Object.entries(requestGroupings).reduce(
    (accumulator, [tag, { requests }]) => {
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
              if (
                'application/json' in content &&
                content['application/json'].schema
              ) {
                if ('$ref' in content['application/json'].schema) {
                  const schemaReference =
                    content['application/json'].schema.$ref;
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
                    if (!accumulator[schemaName].includes(tag)) {
                      accumulator[schemaName].push(tag);
                    }
                  });
                } else if (
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
                    if (!accumulator[schemaName].includes(tag)) {
                      accumulator[schemaName].push(tag);
                    }
                  });
                }
              }

              if (
                'image/png' in content &&
                '$ref' in content['image/png'].schema
              ) {
                const schemaName = BINARY_RESPONSE_TYPE_MODEL_NAME;
                if (!accumulator[schemaName]) {
                  accumulator[schemaName] = [];
                }
                if (!accumulator[schemaName].includes(tag)) {
                  accumulator[schemaName].push(tag);
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
              if (!accumulator[schemaName].includes(tag)) {
                accumulator[schemaName].push(tag);
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
              if (!accumulator[schemaName].includes(tag)) {
                accumulator[schemaName].push(tag);
              }
            });
          }
        }
      );
      return accumulator;
    },
    {} as Record<string, string[]>
  );
  //#endregion

  //#region Generate Schema to entity mappings
  const schemaToEntityMappings = Object.keys(schemaEntityReferences).reduce(
    (accumulator, schemaName) => {
      if (schemaEntityReferences[schemaName].length === 1) {
        accumulator[schemaName] = schemaEntityReferences[schemaName][0];
      } else {
        accumulator[schemaName] = 'Utils';
      }
      return accumulator;
    },
    {} as Record<string, string>
  );
  //#endregion

  //#region Map schema references to entities
  const entitySchemaGroups = Object.keys(schemaEntityReferences).reduce(
    (accumulator, schemaName) => {
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
    },
    {} as Record<string, string[]>
  );
  //#endregion

  //#region Generate validation schemas code
  const models = Object.keys(entitySchemaGroups)
    .sort()
    .reduce(
      (accumulator, entityName) => {
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
                zodValidationSchemaConfiguration,
                referencedSchemas,
                inferedTypeCode,
                zodValidationSchemaName,
                imports,
                tsedModelCode,
                tsedModelConfiguration,
                tsedModelName,
              } = modelCodeConfiguration;

              referencedSchemas.forEach((referencedSchemaName) => {
                const referencedSchemaEntityName =
                  schemaToEntityMappings[referencedSchemaName];
                if (referencedSchemaEntityName != entityName) {
                  addModuleImport({
                    imports,
                    importName: `${referencedSchemaName}ValidationSchema`,
                    importFilePath: `./${referencedSchemaEntityName}`,
                  });

                  if (
                    generateTsEDControllers ||
                    !inferTypeFromValidationSchema
                  ) {
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
                zodValidationSchemaConfiguration,
                zodValidationSchemaName,
                inferedTypeCode,
                generatedVariables,
                imports,
                tsedModelCode,
                tsedModelConfiguration,
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
                modelsReferencingModelsInSameFile.includes(aKey) &&
                !modelsReferencingModelsInSameFile.includes(bKey)
              ) {
                return 1;
              }
              if (
                !modelsReferencingModelsInSameFile.includes(aKey) &&
                modelsReferencingModelsInSameFile.includes(bKey)
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
        //#endregion

        return accumulator;
      },
      {} as Record<
        string,
        {
          models: Record<string, GeneratedSchemaCodeConfiguration>;
          imports?: ModuleImports;
        }
      >
    );
  //#endregion

  //#region Generate models to validation schema mappings
  const modelsToValidationSchemaMappings = Object.keys(models).reduce(
    (accumulator, entityName) => {
      Object.keys(models[entityName].models).forEach((schemaName) => {
        accumulator[schemaName] = models[entityName].models[schemaName];
      });
      return accumulator;
    },
    {} as Record<string, GeneratedSchemaCodeConfiguration>
  );
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

//#region Generate model code
export interface GenerateModelCodeOptions {
  /**
   * The open api specification to use when looking up schemas
   */
  openAPISpecification: OpenAPISpecification;

  /**
   * The name of the schema to generate code for
   */
  schemaName: string;

  /**
   * Whether to generate code for tsed controllers
   */
  generateTsEDControllers?: boolean;

  /**
   * Whether to infer the type from the validation schema
   */
  inferTypeFromValidationSchema?: boolean;
}

export const generateModelCode = ({
  schemaName,
  openAPISpecification,
  generateTsEDControllers,
  inferTypeFromValidationSchema = true,
}: GenerateModelCodeOptions) => {
  const schema = openAPISpecification.components.schemas[schemaName];
  if ('properties' in schema && schema.properties) {
    const referencedSchemas: string[] = [];
    const generatedVariables: Record<string, string> = {};
    const zodValidationSchemaName = `${schemaName}ValidationSchema`;
    const inferedTypeCode = `export type ${schemaName} = z.infer<typeof ${zodValidationSchemaName}>`;
    const imports: ModuleImports = {
      zod: ['z'],
    };
    let modelIsRecursive = false;

    const schemaProperties = schema.properties;

    //#region Zod validation schema
    const getSchemaPrimitiveTypeValidationSchemaCode = (
      property: SchemaProperty,
      propertyName: string
    ): string | undefined => {
      if ('type' in property) {
        switch (property.type) {
          case 'number':
          case 'integer': {
            let validationCode = `z.number()`;
            if (property.min != null) {
              validationCode += `.min(${property.min})`;
            }
            if (property.max != null) {
              validationCode += `.max(${property.max})`;
            }
            return validationCode;
          }
          case 'string': {
            if (property.enum) {
              const enumTypeName =
                `${schemaName} ${propertyName}`.toPascalCase();
              const enumValuesName = `${enumTypeName.toCamelCase()}Options`;

              generatedVariables[
                enumValuesName
              ] = `export const ${enumValuesName} = ${JSON.stringify(
                property.enum
              )} as const`;

              generatedVariables[
                enumTypeName
              ] = `export type ${enumTypeName} = (typeof ${enumValuesName})[number]`;

              return `z.enum(${enumValuesName})`;
            } else {
              let validationCode = `z.string()`;
              if (property.minLength != null) {
                validationCode += `.min(${property.minLength})`;
              }
              if (property.maxLength != null) {
                validationCode += `.max(${property.maxLength})`;
              }
              return validationCode;
            }
          }
          case 'boolean': {
            return `z.boolean()`;
          }
          case 'null':
            return `z.null()`;
          case 'object':
            {
              if (property.properties) {
                const propertiesTypeCode = (() => {
                  const firstProperty = Object.values(property.properties)[0];
                  if (firstProperty) {
                    if (Array.isArray(firstProperty)) {
                      if (
                        'type' in firstProperty[0] &&
                        firstProperty[0].type === 'string'
                      ) {
                        return `z.array(z.string())`;
                      }
                      if ('$ref' in firstProperty[0]) {
                        const referencedSchemaName =
                          firstProperty[0].$ref.replace(
                            '#/components/schemas/',
                            ''
                          );
                        referencedSchemas.push(referencedSchemaName);
                        const validationSchemaName = `${referencedSchemaName}ValidationSchema`;
                        if (referencedSchemaName === schemaName) {
                          modelIsRecursive = true;
                          // return `z.lazy(() => ${validationSchemaName})`; // TODO: Lazy reference validation schema
                          return `z.any()`;
                        }
                        return `z.array(${validationSchemaName})`;
                      }
                    }
                    if ('$ref' in firstProperty) {
                      const referencedSchemaName = firstProperty.$ref.replace(
                        '#/components/schemas/',
                        ''
                      );
                      referencedSchemas.push(referencedSchemaName);
                      const validationSchemaName = `${referencedSchemaName}ValidationSchema`;
                      if (referencedSchemaName === schemaName) {
                        modelIsRecursive = true;
                        // return `z.lazy(() => ${validationSchemaName})`; // TODO: Lazy reference validation schema
                        return `z.any()`;
                      }
                      return validationSchemaName;
                    }
                  }
                  return `z.any()`;
                })();
                return `z.record(${propertiesTypeCode})`;
              }
            }
            break;
          case 'array': {
            if (property.items) {
              if ('$ref' in property.items) {
                const referencedSchemaName = property.items.$ref.replace(
                  '#/components/schemas/',
                  ''
                );
                referencedSchemas.push(referencedSchemaName);
                const validationSchemaName = `${referencedSchemaName}ValidationSchema`;
                if (referencedSchemaName === schemaName) {
                  modelIsRecursive = true;
                  // return `z.array(z.lazy(() => ${validationSchemaName}))`; // TODO: Lazy reference validation schema
                  return `z.array(z.any())`;
                }
                return `z.array(${validationSchemaName})`;
              }
              if (
                'type' in property.items &&
                (
                  [
                    'boolean',
                    'number',
                    'string',
                  ] as (typeof property.items.type)[]
                ).includes(property.items.type)
              ) {
                const zodCodeString =
                  getSchemaPrimitiveTypeValidationSchemaCode(
                    property.items,
                    singular(propertyName)
                  ) || `z.${property.items.type}()`;

                return `z.array(${zodCodeString})`;
              }
            }
            return `z.array(z.any())`;
          }
        }
      }
    };

    const getSchemaTypValidationSchemaCode = (
      property: SchemaProperty | UnionSchemaProperty,
      propertyName: string
    ): string => {
      if ('type' in property) {
        let isNullable = false;
        let code = (() => {
          if (Array.isArray(property.type)) {
            isNullable = property.type.includes('null');
            const nonNullTypes = property.type.filter(
              (type) => type !== 'null'
            );
            if (nonNullTypes.length === 1) {
              return getSchemaPrimitiveTypeValidationSchemaCode(
                {
                  ...property,
                  type: nonNullTypes[0] as any,
                },
                propertyName
              );
            }
            const zodSchemasCode = property.type
              .map((type) => {
                return `z.${type}()`;
              })
              .join(', ');
            return `z.union([${zodSchemasCode}])`;
          } else {
            return getSchemaPrimitiveTypeValidationSchemaCode(
              property,
              propertyName
            );
          }
        })();
        if (code) {
          if (isNullable) {
            code += `.nullable()`;
          }
          if (!schema.required || !schema.required.includes(propertyName)) {
            code += `.optional()`;
          }
          if ('description' in property && property.description) {
            code += `.describe(\`${property.description.replace(
              /(`)/gm,
              '\\`'
            )}\`)`;
          }
          return code;
        }
      }
      if ('$ref' in property) {
        let code = (() => {
          const referencedSchemaName = property.$ref.replace(
            '#/components/schemas/',
            ''
          );
          referencedSchemas.push(referencedSchemaName);
          const validationSchemaName = `${referencedSchemaName}ValidationSchema`;
          if (referencedSchemaName === schemaName) {
            modelIsRecursive = true;
            // return `z.lazy(() => ${validationSchemaName})`; // TODO: Lazy reference validation schema
            return `z.any()`;
          }
          return validationSchemaName;
        })();
        if (code) {
          if (!schema.required || !schema.required.includes(propertyName)) {
            code += `.optional()`;
          }
          if (property.description) {
            code += `.describe(\`${property.description}\`)`;
          }
        }
        return code;
      }
      if ('oneOf' in property) {
        const isNullable = Boolean(
          property.oneOf.find((property) => {
            return 'type' in property && property.type === 'null';
          })
        );

        let code = (() => {
          const nonNullTypes = property.oneOf.filter(
            (property) => !('type' in property && property.type === 'null')
          );

          if (nonNullTypes.length === 1) {
            return getSchemaTypValidationSchemaCode(
              nonNullTypes[0] as any,
              propertyName
            );
          }

          const zodSchemasCode = property.oneOf
            .map((type) => {
              return getSchemaTypValidationSchemaCode(type, propertyName);
            })
            .join(', ');
          return `z.union([${zodSchemasCode}])`;
        })();

        if (isNullable) {
          code += `.nullable()`;
        }

        return code;
      }
      return `z.any()`;
    };

    const zodValidationSchemaConfiguration = Object.entries(
      schemaProperties
    ).reduce((accumulator, [propertyName, property]) => {
      const code = getSchemaTypValidationSchemaCode(
        property as any,
        propertyName
      );
      if (code) {
        accumulator[propertyName] = {
          code,
        };
      }
      return accumulator;
    }, {} as Record<string, ZodValidationSchemaProperty>);

    const zodObjectPropertiesCode = Object.keys(
      zodValidationSchemaConfiguration
    )
      .map((key) => {
        return `'${key}': ${zodValidationSchemaConfiguration[key].code}`;
      })
      .join(',\n');

    const zodValidationSchemaCode = `export const ${zodValidationSchemaName} = z.object({${zodObjectPropertiesCode}})`;
    //#endregion

    //#region Tsed model

    const { tsedModelCode, tsedModelConfiguration } = ((): {
      tsedModelConfiguration?: Record<string, TsedModelProperty>;
      tsedModelCode?: string;
    } => {
      if (
        generateTsEDControllers ||
        !inferTypeFromValidationSchema ||
        modelIsRecursive
      ) {
        const tsedModelConfiguration = Object.entries(schemaProperties).reduce(
          (accumulator, [basePropertyName]) => {
            const propertyName = (() => {
              if (basePropertyName.match(/\W/g)) {
                if (generateTsEDControllers) {
                  return basePropertyName.toCamelCase();
                } else {
                  return `'${basePropertyName}'`;
                }
              }
              return basePropertyName;
            })();
            let isNullable = false;
            const tsedProperty = (():
              | Omit<TsedModelProperty, 'typeDefinitionSnippet'>
              | undefined => {
              const baseProperty = schemaProperties[basePropertyName]!;
              const required = Boolean(
                schema.required && schema.required.includes(basePropertyName)
              );
              const baseTsedPropertyDecorators = [`@Property()`];
              if (generateTsEDControllers) {
                addModuleImport({
                  imports,
                  importName: 'Property',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }

              if (basePropertyName.match(/\W/g)) {
                baseTsedPropertyDecorators.push(`@Name('${basePropertyName}')`);
                if (generateTsEDControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Name',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }

              if (required) {
                baseTsedPropertyDecorators.push(`@Required()`);
                if (generateTsEDControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Required',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }

              if ('description' in baseProperty && baseProperty.description) {
                baseTsedPropertyDecorators.push(
                  `@Description(${JSON.stringify(baseProperty.description)})`
                );
                if (generateTsEDControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Description',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }

              type BaseProperty = Pick<
                TsedModelProperty,
                | 'propertyName'
                | 'accessModifier'
                | 'required'
                | 'decorators'
                | 'openAPISpecification'
              >;

              const getTsEDPrimitivePropertyTypeCode = (
                property: typeof baseProperty,
                baseTsedProperty: BaseProperty
              ):
                | Omit<TsedModelProperty, 'typeDefinitionSnippet'>
                | undefined => {
                if ('type' in property) {
                  switch (property.type) {
                    case 'number':
                    case 'integer': {
                      const decorators = [...baseTsedPropertyDecorators];
                      if (property.min != null) {
                        decorators.push(`@Min(${property.min})`);
                        if (generateTsEDControllers) {
                          addModuleImport({
                            imports,
                            importName: 'Min',
                            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                          });
                        }
                      }
                      if (property.max != null) {
                        decorators.push(`@Max(${property.min})`);
                        if (generateTsEDControllers) {
                          addModuleImport({
                            imports,
                            importName: 'Max',
                            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                          });
                        }
                      }
                      return {
                        ...baseTsedProperty,
                        decorators,
                        propertyType: `number`,
                        propertyModels: [`Number`],
                      };
                    }
                    case 'string': {
                      if (property.format) {
                        switch (property.format) {
                          case 'date-time':
                            baseTsedPropertyDecorators.push(`@DateTime()`);
                            if (generateTsEDControllers) {
                              addModuleImport({
                                imports,
                                importName: 'DateTime',
                                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                              });
                            }
                            break;
                          case 'date':
                            baseTsedPropertyDecorators.push(`@DateFormat()`);
                            if (generateTsEDControllers) {
                              addModuleImport({
                                imports,
                                importName: 'DateFormat',
                                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                              });
                            }
                            break;
                        }
                      }
                      if (property.enum) {
                        const enumTypeName =
                          `${schemaName} ${propertyName}`.toPascalCase();
                        const enumValuesName = `${enumTypeName.toCamelCase()}Options`;

                        if (generateTsEDControllers) {
                          addModuleImport({
                            imports,
                            importName: 'Enum',
                            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                          });
                        }

                        return {
                          ...baseTsedProperty,
                          decorators: [
                            ...baseTsedPropertyDecorators,
                            `@Enum(...${enumValuesName})`,
                          ],
                          propertyType: enumTypeName,
                          propertyModels: [`String`],
                        };
                      } else {
                        const decorators = [...baseTsedPropertyDecorators];
                        if (property.minLength != null) {
                          decorators.push(`@MinLength(${property.minLength})`);
                          if (generateTsEDControllers) {
                            addModuleImport({
                              imports,
                              importName: 'MinLength',
                              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                            });
                          }
                        }
                        if (property.maxLength != null) {
                          decorators.push(`@MaxLength(${property.maxLength})`);
                          if (generateTsEDControllers) {
                            addModuleImport({
                              imports,
                              importName: 'MaxLength',
                              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                            });
                          }
                        }
                        return {
                          ...baseTsedProperty,
                          decorators,
                          propertyType: `string`,
                          propertyModels: [`String`],
                        };
                      }
                    }
                    case 'boolean': {
                      return {
                        ...baseTsedProperty,
                        propertyType: `boolean`,
                        propertyModels: [`Boolean`],
                      };
                    }
                    case 'object':
                      {
                        if (property.properties) {
                          if (generateTsEDControllers) {
                            addModuleImport({
                              imports,
                              importName: 'RecordOf',
                              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                            });
                          }
                          const propertiesTypeCode = (() => {
                            const firstProperty = Object.values(
                              property.properties
                            )[0];
                            if (firstProperty) {
                              if (Array.isArray(firstProperty)) {
                                if (
                                  'type' in firstProperty[0] &&
                                  firstProperty[0].type === 'string'
                                ) {
                                  return `string[]`;
                                }
                                if ('$ref' in firstProperty[0]) {
                                  const schemaName =
                                    firstProperty[0].$ref.replace(
                                      '#/components/schemas/',
                                      ''
                                    );
                                  return `${schemaName}[]`;
                                }
                              }
                              if ('$ref' in firstProperty) {
                                const schemaName = firstProperty.$ref.replace(
                                  '#/components/schemas/',
                                  ''
                                );
                                return schemaName;
                              }
                            }
                            return `any`;
                          })();
                          return {
                            ...baseTsedProperty,
                            propertyType: `Record<string, ${propertiesTypeCode}>`,
                            decorators: [
                              ...baseTsedPropertyDecorators,
                              `@RecordOf([String])`,
                            ],
                            propertyModels: [`Object`],
                          };
                        }
                      }
                      break;
                    case 'array': {
                      if (property.items) {
                        if ('$ref' in property.items) {
                          const schemaName = property.items.$ref.replace(
                            '#/components/schemas/',
                            ''
                          );
                          if (generateTsEDControllers) {
                            addModuleImport({
                              imports,
                              importName: 'ArrayOf',
                              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                            });
                          }
                          return {
                            ...baseTsedProperty,
                            propertyType: `${schemaName}[]`,
                            decorators: [
                              ...baseTsedPropertyDecorators,
                              `@ArrayOf(${schemaName})`,
                            ],
                            propertyModels: [schemaName],
                          };
                        }
                        if (
                          'type' in property.items &&
                          (
                            [
                              'boolean',
                              'number',
                              'string',
                            ] as (typeof property.items.type)[]
                          ).includes(property.items.type)
                        ) {
                          const decorators = [...baseTsedPropertyDecorators];
                          const enumTypeName = (() => {
                            if (
                              property.items.type === 'string' &&
                              property.items.enum
                            ) {
                              return `${schemaName.toPascalCase()}${singular(
                                baseTsedProperty.propertyName
                              ).toPascalCase()}`;
                            }
                          })();
                          const propertyType = (() => {
                            if (
                              property.items.type === 'string' &&
                              property.items.enum &&
                              enumTypeName
                            ) {
                              return `${enumTypeName}[]`;
                            }
                            return `${property.items.type}[]`;
                          })();
                          if (
                            property.items.type === 'string' &&
                            property.items.enum &&
                            enumTypeName
                          ) {
                            if (generateTsEDControllers) {
                              addModuleImport({
                                imports,
                                importName: 'Enum',
                                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                              });
                            }
                            decorators.push(
                              `@Enum(...${enumTypeName.toCamelCase()}Options)`
                            );
                          } else {
                            if (generateTsEDControllers) {
                              addModuleImport({
                                imports,
                                importName: 'ArrayOf',
                                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                              });
                            }
                            decorators.push(
                              `@ArrayOf(${property.items.type.toPascalCase()})`
                            );
                          }
                          return {
                            ...baseTsedProperty,
                            propertyType,
                            decorators,
                            propertyModels: [
                              property.items.type.toPascalCase(),
                            ],
                          };
                        }
                      }
                      return {
                        ...baseTsedProperty,
                        propertyType: `any[]`,
                        propertyModels: [],
                      };
                    }
                  }
                }
              };

              const getTsEDPropertyTypeCode = (
                property: typeof baseProperty,
                propertyName: string
              ):
                | Omit<TsedModelProperty, 'typeDefinitionSnippet'>
                | undefined => {
                const baseTsedProperty: Pick<
                  TsedModelProperty,
                  | 'propertyName'
                  | 'accessModifier'
                  | 'required'
                  | 'decorators'
                  | 'openAPISpecification'
                > = {
                  openAPISpecification: baseProperty as any,
                  propertyName,
                  accessModifier: 'public',
                  decorators: baseTsedPropertyDecorators,
                  required,
                };

                if ('type' in property) {
                  if ('example' in property) {
                    baseTsedPropertyDecorators.push(
                      `@Example(${JSON.stringify(property.example)})`
                    );
                    if (generateTsEDControllers) {
                      addModuleImport({
                        imports,
                        importName: 'Example',
                        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                      });
                    }
                  }

                  if ('default' in property && property.default) {
                    baseTsedPropertyDecorators.push(
                      `@Default(${JSON.stringify(property.default)})`
                    );
                    if (generateTsEDControllers) {
                      addModuleImport({
                        imports,
                        importName: 'Default',
                        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                      });
                    }
                  }

                  if (Array.isArray(property.type)) {
                    isNullable = property.type.includes('null');

                    const nonNullTypes = property.type.filter(
                      (type) => type !== 'null'
                    );

                    if (nonNullTypes.length === 1) {
                      return getTsEDPrimitivePropertyTypeCode(
                        {
                          ...property,
                          type: nonNullTypes[0] as any,
                        },
                        baseTsedProperty
                      );
                    }

                    const propertyType = property.type
                      .map((type) => {
                        return type;
                      })
                      .join(' | ');
                    return {
                      ...baseTsedProperty,
                      propertyType,
                      propertyModels: [],
                    };
                  } else {
                    return getTsEDPrimitivePropertyTypeCode(
                      property,
                      baseTsedProperty
                    );
                  }
                }

                if ('$ref' in property) {
                  const schemaName = property.$ref.replace(
                    '#/components/schemas/',
                    ''
                  );
                  return {
                    ...baseTsedProperty,
                    propertyType: schemaName,
                    decorators: [...baseTsedPropertyDecorators],
                    propertyModels: [schemaName],
                  };
                }

                if ('oneOf' in property) {
                  // isNullable = Boolean(
                  //   property.oneOf.find((property) => {
                  //     return 'type' in property && property.type === 'null';
                  //   })
                  // );

                  let code = (() => {
                    const nonNullTypes = property.oneOf.filter(
                      (property) =>
                        !('type' in property && property.type === 'null')
                    );

                    if (nonNullTypes.length === 1) {
                      return getTsEDPropertyTypeCode(
                        nonNullTypes[0] as any,
                        propertyName
                      );
                    }

                    const propertyCode = property.oneOf.map((type) => {
                      return getTsEDPropertyTypeCode(type, propertyName);
                    });

                    return {
                      ...baseTsedProperty,
                      propertyType: propertyCode
                        .map((code) => code!.propertyType)
                        .join(' | '),
                      propertyModels: propertyCode.reduce(
                        (acumulator, code) => {
                          if (code?.propertyModels) {
                            acumulator.push(...code.propertyModels);
                          }
                          return acumulator;
                        },
                        [] as string[]
                      ),
                    };
                  })();

                  return code;
                }

                return {
                  ...baseTsedProperty,
                  propertyType: `any`,
                  propertyModels: [],
                };
              };

              return getTsEDPropertyTypeCode(baseProperty, propertyName);
            })();
            if (tsedProperty) {
              if (isNullable) {
                const nullableModelsCode = (() => {
                  if (tsedProperty.propertyModels.length > 0) {
                    return tsedProperty.propertyModels.join(', ');
                  }
                  addModuleImport({
                    imports,
                    importName: 'Any',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                  return `Any`;
                })();
                tsedProperty.decorators.push(
                  `@Nullable(${nullableModelsCode})`
                );
                if (generateTsEDControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Nullable',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }
              const propertyValueSeparator = tsedProperty.required
                ? '!:'
                : '?:';
              accumulator[propertyName] = {
                ...tsedProperty,
                typeDefinitionSnippet: `
                ${tsedProperty.decorators.join('\n')}
                ${tsedProperty.accessModifier} ${
                  tsedProperty.propertyName
                }${propertyValueSeparator} ${tsedProperty.propertyType}
              `.trimIndent(),
              };
            }
            return accumulator;
          },
          {} as Record<string, TsedModelProperty>
        );

        const tsedModelPropertiesCode = Object.keys(tsedModelConfiguration)
          .map((key) => {
            return tsedModelConfiguration[key].typeDefinitionSnippet;
          })
          .join(';\n\n');

        const tsedModelCode = `
        export class ${schemaName} {
          ${tsedModelPropertiesCode}
        }
      `.trimIndent();

        return {
          tsedModelConfiguration,
          tsedModelCode,
        };
      }
      return {};
    })();
    //#endregion

    const schemaCode = [
      ...(() => {
        if (!isEmpty(generatedVariables)) {
          return Object.values(generatedVariables);
        }
        return [];
      })(),
      zodValidationSchemaCode,
      ...(() => {
        if (generateTsEDControllers && tsedModelCode) {
          return [tsedModelCode];
        }
        if (
          (!inferTypeFromValidationSchema || modelIsRecursive) &&
          tsedModelConfiguration
        ) {
          const interfacePropertiesCode = Object.keys(tsedModelConfiguration)
            .map((key) => {
              const {
                propertyName,
                propertyType,
                required,
                openAPISpecification,
              } = tsedModelConfiguration[key];
              const propertyValueSeparator = required ? ': ' : '?: ';
              const propertyValueSnippet = `${propertyName}${propertyValueSeparator} ${propertyType}`;
              const jsDocCommentLines: string[] = [];
              if (
                'description' in openAPISpecification &&
                openAPISpecification.description
              ) {
                jsDocCommentLines.push(openAPISpecification.description);
              }
              if (
                'example' in openAPISpecification &&
                openAPISpecification.example
              ) {
                jsDocCommentLines.push(
                  `@example ${JSON.stringify(openAPISpecification.example)}`
                );
              }
              if (
                'default' in openAPISpecification &&
                openAPISpecification.default
              ) {
                jsDocCommentLines.push(
                  `@default ${JSON.stringify(openAPISpecification.default)}`
                );
              }

              if (jsDocCommentLines.length > 0) {
                const linesString = jsDocCommentLines
                  .reduce((acumulator, line) => {
                    acumulator.push(...line.split('\n'));
                    return acumulator;
                  }, [] as string[])
                  .map((line) => {
                    return ` * ${line}`;
                  })
                  .join('\n *\n');
                const jsDocCommentCode = `
                  /**
                   ${linesString}
                  */
                `.trimIndent();

                return `${jsDocCommentCode}\n${propertyValueSnippet}`;
              }

              return propertyValueSnippet;
            })
            .join(';\n\n');

          const interfaceCode = `
          export interface ${schemaName} {
            ${interfacePropertiesCode}
          }
        `.trimIndent();

          return [interfaceCode];
        }
        return [inferedTypeCode];
      })(),
    ].join('\n\n');

    return {
      zodValidationSchemaCode: `
      //#region ${schemaName}
      ${schemaCode}
      //#endregion
    `.trimIndent(),
      zodValidationSchemaConfiguration,
      referencedSchemas,
      zodValidationSchemaName,
      inferedTypeCode,
      imports,
      ...(() => {
        if (!isEmpty(generatedVariables)) {
          return {
            generatedVariables,
          };
        }
      })(),
      ...(() => {
        if (generateTsEDControllers) {
          return {
            tsedModelConfiguration,
            tsedModelCode,
            tsedModelName: schemaName,
          };
        }
      })(),
    };
  }
};
//#endregion
