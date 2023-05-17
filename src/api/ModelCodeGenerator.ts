import { isEmpty } from 'lodash';

import { ModuleImports, OpenAPISpecification } from '../models';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  ENVIRONMENT_DEFINED_MODELS,
  GeneratedSchemaCodeConfiguration,
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
  generateTsedControllers?: boolean;
}

export const generateModelMappings = ({
  requestGroupings,
  openAPISpecification,
  generateTsedControllers,
  inferTypeFromValidationSchema,
}: GenerateModelMappingsOptions) => {
  //#region Find all Schemas referenced in the requests
  const schemaEntityReferences = Object.values(requestGroupings).reduce(
    (accumulator, { requests }) => {
      requests.forEach(
        ({
          tags,
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
                '$ref' in content['application/json'].schema
              ) {
                const schemaReference = content['application/json'].schema.$ref;
                const schemaName = schemaReference.split('/').pop()!;
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
                  tags.forEach((tag) => {
                    if (!accumulator[schemaName].includes(tag)) {
                      accumulator[schemaName].push(tag);
                    }
                  });
                });
              }
              if (
                'image/png' in content &&
                '$ref' in content['image/png'].schema
              ) {
                const schemaName = BINARY_RESPONSE_TYPE_MODEL_NAME;
                if (!accumulator[schemaName]) {
                  accumulator[schemaName] = [];
                }
                tags.forEach((tag) => {
                  if (!accumulator[schemaName].includes(tag)) {
                    accumulator[schemaName].push(tag);
                  }
                });
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
              tags.forEach((tag) => {
                if (!accumulator[schemaName].includes(tag)) {
                  accumulator[schemaName].push(tag);
                }
              });
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
              tags.forEach((tag) => {
                if (!accumulator[schemaName].includes(tag)) {
                  accumulator[schemaName].push(tag);
                }
              });
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
            } = generateModelCode({
              schemaName,
              openAPISpecification,
              generateTsedControllers,
              inferTypeFromValidationSchema,
            });

            referencedSchemas.forEach((referencedSchemaName) => {
              const referencedSchemaEntityName =
                schemaToEntityMappings[referencedSchemaName];
              if (referencedSchemaEntityName != entityName) {
                addModuleImport({
                  imports,
                  importName: `${referencedSchemaName}ValidationSchema`,
                  importFilePath: `./${referencedSchemaEntityName}`,
                });

                if (generateTsedControllers || !inferTypeFromValidationSchema) {
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
  generateTsedControllers?: boolean;

  /**
   * Whether to infer the type from the validation schema
   */
  inferTypeFromValidationSchema?: boolean;
}

export const generateModelCode = ({
  schemaName,
  openAPISpecification,
  generateTsedControllers,
  inferTypeFromValidationSchema = true,
}: GenerateModelCodeOptions) => {
  const schema = openAPISpecification.components.schemas[schemaName];
  const referencedSchemas: string[] = [];
  const generatedVariables: Record<string, string> = {};
  const zodValidationSchemaName = `${schemaName}ValidationSchema`;
  const inferedTypeCode = `export type ${schemaName} = z.infer<typeof ${zodValidationSchemaName}>`;
  const imports: ModuleImports = {
    zod: ['z'],
  };
  let modelIsRecursive = false;

  const schemaProperties = schema.properties || {};

  //#region Zod validation schema
  const zodValidationSchemaConfiguration = Object.keys(schemaProperties).reduce(
    (accumulator, propertyName) => {
      const code = (() => {
        const property = schemaProperties[propertyName];
        if ('type' in property) {
          let code = (() => {
            switch (property.type) {
              case 'number': {
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
                  const enumTypeName = `${schemaName.toPascalCase()}${propertyName.toPascalCase()}`;
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
              case 'object':
                {
                  if (property.properties) {
                    const propertiesTypeCode = (() => {
                      const firstProperty = Object.values(
                        property.properties
                      )[0];
                      if (
                        Array.isArray(firstProperty) &&
                        firstProperty[0].type === 'string'
                      ) {
                        return `z.array(z.string())`;
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
                    return `z.array(z.${property.items.type}())`;
                  }
                }
                return `z.array(z.any())`;
              }
            }
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
      })();
      if (code) {
        accumulator[propertyName] = {
          code,
        };
      }
      return accumulator;
    },
    {} as Record<string, ZodValidationSchemaProperty>
  );

  const zodObjectPropertiesCode = Object.keys(zodValidationSchemaConfiguration)
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
      generateTsedControllers ||
      !inferTypeFromValidationSchema ||
      modelIsRecursive
    ) {
      const tsedModelConfiguration = Object.keys(schemaProperties).reduce(
        (accumulator, basePropertyName) => {
          const propertyName = (() => {
            if (basePropertyName.match(/\W/g)) {
              if (generateTsedControllers) {
                return basePropertyName.toCamelCase();
              } else {
                return `'${basePropertyName}'`;
              }
            }
            return basePropertyName;
          })();
          const tsedProperty = (():
            | Omit<TsedModelProperty, 'typeDefinitionSnippet'>
            | undefined => {
            const property = schemaProperties[basePropertyName];
            const required = Boolean(
              schema.required && schema.required.includes(basePropertyName)
            );
            const baseTsedPropertyDecorators = [`@Property()`];
            if (generateTsedControllers) {
              addModuleImport({
                imports,
                importName: 'Property',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }

            if (basePropertyName.match(/\W/g)) {
              baseTsedPropertyDecorators.push(`@Name('${basePropertyName}')`);
              if (generateTsedControllers) {
                addModuleImport({
                  imports,
                  importName: 'Name',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
            }

            if (required) {
              baseTsedPropertyDecorators.push(`@Required()`);
              if (generateTsedControllers) {
                addModuleImport({
                  imports,
                  importName: 'Required',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
            }

            if (property.description) {
              baseTsedPropertyDecorators.push(
                `@Description(${JSON.stringify(property.description)})`
              );
              if (generateTsedControllers) {
                addModuleImport({
                  imports,
                  importName: 'Description',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
            }

            const baseTsedProperty: Pick<
              TsedModelProperty,
              | 'propertyName'
              | 'accessModifier'
              | 'required'
              | 'decorators'
              | 'openAPISpecification'
            > = {
              openAPISpecification: property,
              propertyName,
              accessModifier: 'public',
              decorators: baseTsedPropertyDecorators,
              required,
            };

            if ('type' in property) {
              if (property.example) {
                baseTsedPropertyDecorators.push(
                  `@Example(${JSON.stringify(property.example)})`
                );
                if (generateTsedControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Example',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }

              if (property.default) {
                baseTsedPropertyDecorators.push(
                  `@Default(${JSON.stringify(property.default)})`
                );
                if (generateTsedControllers) {
                  addModuleImport({
                    imports,
                    importName: 'Default',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
              }

              switch (property.type) {
                case 'number': {
                  const decorators = [...baseTsedPropertyDecorators];
                  if (property.min != null) {
                    decorators.push(`@Min(${property.min})`);
                    if (generateTsedControllers) {
                      addModuleImport({
                        imports,
                        importName: 'Min',
                        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                      });
                    }
                  }
                  if (property.max != null) {
                    decorators.push(`@Max(${property.min})`);
                    if (generateTsedControllers) {
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
                  };
                }
                case 'string': {
                  if (property.format) {
                    switch (property.format) {
                      case 'date-time':
                        baseTsedPropertyDecorators.push(`@DateTime()`);
                        if (generateTsedControllers) {
                          addModuleImport({
                            imports,
                            importName: 'DateTime',
                            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                          });
                        }
                        break;
                      case 'date':
                        baseTsedPropertyDecorators.push(`@DateFormat()`);
                        if (generateTsedControllers) {
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
                    const enumTypeName = `${schemaName.toPascalCase()}${propertyName.toPascalCase()}`;
                    const enumValuesName = `${enumTypeName.toCamelCase()}Options`;

                    if (generateTsedControllers) {
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
                    };
                  } else {
                    const decorators = [...baseTsedPropertyDecorators];
                    if (property.minLength != null) {
                      decorators.push(`@MinLength(${property.minLength})`);
                      if (generateTsedControllers) {
                        addModuleImport({
                          imports,
                          importName: 'MinLength',
                          importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                        });
                      }
                    }
                    if (property.maxLength != null) {
                      decorators.push(`@MaxLength(${property.maxLength})`);
                      if (generateTsedControllers) {
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
                    };
                  }
                }
                case 'boolean': {
                  return {
                    ...baseTsedProperty,
                    propertyType: `boolean`,
                  };
                }
                case 'object':
                  {
                    if (property.properties) {
                      if (generateTsedControllers) {
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
                        if (
                          Array.isArray(firstProperty) &&
                          firstProperty[0].type === 'string'
                        ) {
                          return `string[]`;
                        }
                        if ('$ref' in firstProperty) {
                          const schemaName = firstProperty.$ref.replace(
                            '#/components/schemas/',
                            ''
                          );
                          return schemaName;
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
                      if (generateTsedControllers) {
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
                      if (generateTsedControllers) {
                        addModuleImport({
                          imports,
                          importName: 'ArrayOf',
                          importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                        });
                      }
                      return {
                        ...baseTsedProperty,
                        propertyType: `${property.items.type}[]`,
                        decorators: [
                          ...baseTsedPropertyDecorators,
                          `@ArrayOf(${property.items.type.toPascalCase()})`,
                        ],
                      };
                    }
                  }
                  return {
                    ...baseTsedProperty,
                    propertyType: `any[]`,
                  };
                }
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
                decorators: [
                  ...baseTsedPropertyDecorators,
                  `@ArrayOf(${schemaName})`,
                ],
              };
            }
          })();
          if (tsedProperty) {
            const propertyValueSeparator = tsedProperty.required ? '!:' : '?:';
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
      if (generateTsedControllers && tsedModelCode) {
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
      if (generateTsedControllers) {
        return {
          tsedModelConfiguration,
          tsedModelCode,
          tsedModelName: schemaName,
        };
      }
    })(),
  };
};
//#endregion
