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
export interface GenerateModelMappingsOptions {
  swaggerDocs: OpenAPISpecification;
  requestGroupings: RequestGroupings;
  generateTsedControllers?: boolean;
}
export const generateModelMappings = ({
  requestGroupings,
  swaggerDocs,
  generateTsedControllers,
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
                    swaggerDocs,
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
                swaggerDocs,
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
                swaggerDocs,
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
              swaggerDocs,
              generateTsedControllers,
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

                if (generateTsedControllers) {
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
  swaggerDocs: OpenAPISpecification;
  schemaName: string;
  generateTsedControllers?: boolean;
}
export const generateModelCode = ({
  schemaName,
  swaggerDocs,
  generateTsedControllers,
}: GenerateModelCodeOptions) => {
  const schema = swaggerDocs.components.schemas[schemaName];
  const referencedSchemas: string[] = [];
  const generatedVariables: Record<string, string> = {};
  const zodValidationSchemaName = `${schemaName}ValidationSchema`;
  const inferedTypeCode = `export type ${schemaName} = z.infer<typeof ${zodValidationSchemaName}>`;
  const imports: ModuleImports = {
    zod: ['z'],
  };

  const schemaProperties = schema.properties || {};

  //#region Zod validation schema
  const zodValidationSchemaConfiguration = Object.keys(schemaProperties).reduce(
    (accumulator, propertyName) => {
      const code = (() => {
        const property = schemaProperties[propertyName];
        if ('type' in property) {
          const code = (() => {
            switch (property.type) {
              case 'array': {
                if (property.items && '$ref' in property.items) {
                  const schemaName = property.items.$ref.replace(
                    '#/components/schemas/',
                    ''
                  );
                  referencedSchemas.push(schemaName);
                  return `z.array(${schemaName}ValidationSchema)`;
                }
                return `z.array(z.any())`;
              }
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
            }
          })();
          if (
            code &&
            (!schema.required || !schema.required.includes(propertyName))
          ) {
            return `${code}.nullish()`;
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

  //#region Tsed controller
  const tsedModelConfiguration = Object.keys(schemaProperties).reduce(
    (accumulator, propertyName) => {
      const tsedProperty = (():
        | Omit<TsedModelProperty, 'typeDefinitionSnippet'>
        | undefined => {
        const property = schemaProperties[propertyName];
        if (propertyName.match(/^\w+$/g) && 'type' in property) {
          const required = Boolean(
            schema.required && schema.required.includes(propertyName)
          );
          const baseTsedPropertyDecorators = [`@Property()`];
          addModuleImport({
            imports,
            importName: 'Property',
            importFilePath: TSED_SCHEMA_LIBRARY_PATH,
          });
          if (required) {
            baseTsedPropertyDecorators.push(`@Required()`);
            addModuleImport({
              imports,
              importName: 'Required',
              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
            });
          }
          const baseTsedProperty: Pick<
            TsedModelProperty,
            'propertyName' | 'accessModifier' | 'required' | 'decorators'
          > = {
            propertyName,
            accessModifier: 'public',
            decorators: baseTsedPropertyDecorators,
            required,
          };

          switch (property.type) {
            case 'array': {
              if (property.items && '$ref' in property.items) {
                const schemaName = property.items.$ref.replace(
                  '#/components/schemas/',
                  ''
                );
                addModuleImport({
                  imports,
                  importName: 'ArrayOf',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
                return {
                  ...baseTsedProperty,
                  propertyType: `${schemaName}[]`,
                  decorators: [
                    ...baseTsedPropertyDecorators,
                    `@ArrayOf(${schemaName})`,
                  ],
                };
              }
              return {
                ...baseTsedProperty,
                propertyType: `${schemaName}[]`,
              };
            }
            case 'number': {
              const decorators = [...baseTsedPropertyDecorators];
              if (property.min != null) {
                decorators.push(`@Min(${property.min})`);
                addModuleImport({
                  imports,
                  importName: 'Min',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
              if (property.max != null) {
                decorators.push(`@Max(${property.min})`);
                addModuleImport({
                  imports,
                  importName: 'Max',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
              return {
                ...baseTsedProperty,
                decorators,
                propertyType: `number`,
              };
            }
            case 'string': {
              if (property.enum) {
                const enumTypeName = `${schemaName.toPascalCase()}${propertyName.toPascalCase()}`;
                const enumValuesName = `${enumTypeName.toCamelCase()}Options`;

                addModuleImport({
                  imports,
                  importName: 'Enum',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });

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
                  addModuleImport({
                    imports,
                    importName: 'MinLength',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
                }
                if (property.maxLength != null) {
                  decorators.push(`@MaxLength(${property.maxLength})`);
                  addModuleImport({
                    imports,
                    importName: 'MaxLength',
                    importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                  });
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
          }
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
      if (generateTsedControllers) {
        return [tsedModelCode];
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
