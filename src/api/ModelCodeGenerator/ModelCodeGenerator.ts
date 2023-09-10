import { isEmpty } from 'lodash';
import { singular } from 'pluralize';

import { ModuleImports, OpenAPISpecification } from '../../models';
import { OneOfSchema, Schema } from '../../models/OpenAPISpecification/Schema';
import {
  TSED_SCHEMA_LIBRARY_PATH,
  TsedModelProperty,
  ZodValidationSchemaProperty,
} from '../../models/TypescriptAPIGenerator';
import { addModuleImport } from '../Utils';

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
      property: Schema,
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
              if (
                property.properties ||
                ('additionalProperties' in property &&
                  property.additionalProperties)
              ) {
                const propertiesTypeCode = (() => {
                  if (
                    'additionalProperties' in property &&
                    property.additionalProperties
                  ) {
                    if ('type' in property.additionalProperties) {
                      switch (property.additionalProperties.type) {
                        case 'boolean':
                        case 'number':
                        case 'string':
                          return property.additionalProperties.type;
                        case 'array':
                          if (
                            property.additionalProperties.items &&
                            'type' in property.additionalProperties.items &&
                            ['string', 'number', 'boolean'].includes(
                              property.additionalProperties.items.type
                            )
                          ) {
                            return `z.array(z.${property.additionalProperties.items.type}())`;
                          }
                          if (
                            property.additionalProperties.items &&
                            '$ref' in property.additionalProperties.items
                          ) {
                            const schemaName =
                              property.additionalProperties.items.$ref.replace(
                                '#/components/schemas/',
                                ''
                              );
                            return `z.array(${schemaName}ValidationSchema)`;
                          }
                          break;
                      }
                    }
                    if (
                      '$ref' in property.additionalProperties &&
                      typeof property.additionalProperties.$ref === 'string'
                    ) {
                      const schemaName =
                        property.additionalProperties.$ref.replace(
                          '#/components/schemas/',
                          ''
                        );
                      return `${schemaName}ValidationSchema`;
                    }
                  }
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
                    if (
                      typeof firstProperty === 'object' &&
                      '$ref' in firstProperty &&
                      typeof firstProperty.$ref === 'string'
                    ) {
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

    const getSchemaTypeValidationSchemaCode = (
      property: Schema | OneOfSchema,
      propertyName: string
    ): string => {
      const isNullable = Boolean(
        ('nullable' in property && property.nullable) ||
          ('oneOf' in property &&
            property.oneOf.find((property) => {
              return 'type' in property && property.type === 'null';
            }))
      );
      let code = (() => {
        if ('type' in property) {
          let code = (() => {
            if (Array.isArray(property.type)) {
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
          let code = (() => {
            const nonNullTypes = property.oneOf.filter(
              (property) => !('type' in property && property.type === 'null')
            );

            if (nonNullTypes.length === 1) {
              return getSchemaTypeValidationSchemaCode(
                nonNullTypes[0] as any,
                propertyName
              );
            }

            const zodSchemasCode = property.oneOf
              .map((type) => {
                return getSchemaTypeValidationSchemaCode(type, propertyName);
              })
              .join(', ');
            return `z.union([${zodSchemasCode}])`;
          })();

          return code;
        }
        return `z.any()`;
      })();
      if (isNullable) {
        code += `.nullable()`;
      }
      return code;
    };

    const zodValidationSchemaConfiguration = Object.entries(
      schemaProperties
    ).reduce((accumulator, [propertyName, property]) => {
      const code = getSchemaTypeValidationSchemaCode(
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
          (accumulator, [basePropertyName, property]) => {
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
                    case 'object': {
                      if (
                        property.properties ||
                        ('additionalProperties' in property &&
                          property.additionalProperties)
                      ) {
                        if (generateTsEDControllers) {
                          addModuleImport({
                            imports,
                            importName: 'RecordOf',
                            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                          });
                        }
                        const propertiesTypeCode = (() => {
                          if (
                            'additionalProperties' in property &&
                            property.additionalProperties
                          ) {
                            if ('type' in property.additionalProperties) {
                              switch (property.additionalProperties.type) {
                                case 'boolean':
                                case 'number':
                                case 'string':
                                  return property.additionalProperties.type;
                                case 'array':
                                  if (
                                    property.additionalProperties.items &&
                                    'type' in
                                      property.additionalProperties.items &&
                                    ['string', 'number', 'boolean'].includes(
                                      property.additionalProperties.items.type
                                    )
                                  ) {
                                    return `${property.additionalProperties.items.type}[]`;
                                  }
                                  if (
                                    property.additionalProperties.items &&
                                    '$ref' in
                                      property.additionalProperties.items
                                  ) {
                                    const schemaName =
                                      property.additionalProperties.items.$ref.replace(
                                        '#/components/schemas/',
                                        ''
                                      );
                                    return `${schemaName}[]`;
                                  }
                                  break;
                              }
                            }
                            if (
                              '$ref' in property.additionalProperties &&
                              typeof property.additionalProperties.$ref ===
                                'string'
                            ) {
                              const schemaName =
                                property.additionalProperties.$ref.replace(
                                  '#/components/schemas/',
                                  ''
                                );
                              return schemaName;
                            }
                          }
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
                            if (
                              typeof firstProperty === 'object' &&
                              '$ref' in firstProperty &&
                              typeof firstProperty.$ref === 'string'
                            ) {
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
                      return {
                        ...baseTsedProperty,
                        propertyType: `any`,
                        decorators: [...baseTsedPropertyDecorators],
                        propertyModels: [`Object`],
                      };
                    }
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
              let propertyTypeCode = tsedProperty.propertyType;
              const isNullable = Boolean(
                property &&
                  (('type' in property && property.type.includes('null')) ||
                    ('nullable' in property && property.nullable))
              );
              if (isNullable) {
                tsedProperty.isNullable = true;
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
                propertyTypeCode = `${propertyTypeCode} | null`;
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
                }${propertyValueSeparator} ${propertyTypeCode}
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
                isNullable,
              } = tsedModelConfiguration[key];
              let propertiesTypeCode = propertyType;
              if (isNullable) {
                propertiesTypeCode = `${propertiesTypeCode} | null`;
              }
              const propertyValueSeparator =
                required && propertiesTypeCode !== 'any' ? ': ' : '?: ';
              const propertyValueSnippet = `${propertyName}${propertyValueSeparator} ${propertiesTypeCode}`;
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
                if (typeof openAPISpecification.example === 'object') {
                  jsDocCommentLines.push(
                    `@example\n\`\`\`json\n${JSON.stringify(
                      openAPISpecification.example,
                      null,
                      2
                    )}\n\`\`\``
                  );
                } else {
                  jsDocCommentLines.push(
                    `@example ${JSON.stringify(openAPISpecification.example)}`
                  );
                }
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
                    acumulator.push(line);
                    return acumulator;
                  }, [] as string[])
                  .map((line) => {
                    return line
                      .split('\n')
                      .map((lineSlice) => ` * ${lineSlice}`)
                      .join('\n');
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
