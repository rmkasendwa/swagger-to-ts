import {
  ModuleImports,
  TSED_SCHEMA_LIBRARY_PATH,
  primitiveTypeModels,
  primitiveTypeToModelMapping,
} from '../../models';
import { ObjectSchema, Schema } from '../../models/OpenAPISpecification/Schema';
import { addModuleImport } from '../Utils';
import { generateBooleanSchemaCode } from './BooleanSchemaCodeGenerator';
import {
  SchemaCodeConfiguration,
  SchemaCodeGeneratorFunctionOptions,
} from './models';
import { generateNullSchemaCode } from './NullSchemaCodeGenerator';
import { generateNumberSchemaCode } from './NumberSchemaCodeGenerator';
import { generateStringSchemaCode } from './StringSchemaCodeGenerator';

export interface GeneratePropertySchemaCodeOptions {
  /**
   * The schema that the property belongs to
   */
  schema: ObjectSchema;

  /**
   * The name of the schema that the property belongs to
   */
  schemaName: string;

  /**
   * The property schema to generate code for
   */
  propertySchema: Schema;

  /**
   * The name of the property on the schema to generate code for
   */
  propertyName: string;

  /**
   * Whether to generate code for tsed controllers
   */
  generateTsEDControllers?: boolean;
}

/**
 * Generates string schema code for a given schema
 *
 * @param options The options to generate string schema code
 * @returns The generated string schema code
 */
export const generatePropertySchemaCode = (
  options: GeneratePropertySchemaCodeOptions
) => {
  const {
    propertySchema,
    schema,
    schemaName,
    propertyName,
    generateTsEDControllers,
  } = options;
  const referencedSchemas: string[] = [];
  const generatedVariables: Record<string, string> = {};
  const imports: ModuleImports = {
    zod: ['z'],
  };
  const propertySchemaCodeConfiguration: SchemaCodeConfiguration = {
    openAPISpecification: propertySchema,
    propertyName,
    accessModifier: 'public',
    decorators: [],
    required: Boolean(schema.required?.includes(propertyName)),
    isNullable: propertySchema.nullable,
    zodCodeString: `z.any()`,
    propertyModels: [],
    propertyType: `any`,
  };

  if ('$ref' in propertySchema) {
    const referencedSchemaName = propertySchema.$ref.replace(
      '#/components/schemas/',
      ''
    );
    referencedSchemas.push(referencedSchemaName);
    propertySchemaCodeConfiguration.propertyModels.push(referencedSchemaName);
    propertySchemaCodeConfiguration.propertyType = referencedSchemaName;
    propertySchemaCodeConfiguration.zodCodeString = `${referencedSchemaName}ValidationSchema`;
  } else if ('type' in propertySchema) {
    const { decorators, ...rest } = ((): Partial<SchemaCodeConfiguration> => {
      const baseOptions: SchemaCodeGeneratorFunctionOptions<
        typeof propertySchema
      > = {
        generatedVariables,
        generateTsEDControllers,
        imports,
        propertyName,
        schemaName,
        schema: propertySchema,
      };
      switch (propertySchema.type) {
        case 'string':
          return generateStringSchemaCode({
            ...baseOptions,
            schema: propertySchema,
          });
        case 'boolean':
          return generateBooleanSchemaCode({
            ...baseOptions,
            schema: propertySchema,
          });
        case 'integer':
        case 'number':
          return generateNumberSchemaCode({
            ...baseOptions,
            schema: propertySchema,
          });
        case 'null':
          return generateNullSchemaCode({
            ...baseOptions,
            schema: propertySchema,
          });
        case 'object':
          if (
            'additionalProperties' in propertySchema &&
            typeof propertySchema.additionalProperties === 'object'
          ) {
            const {
              propertyType,
              zodCodeString,
              imports: propertyImports,
              generatedVariables: propertyGeneratedVariables,
            } = generatePropertySchemaCode({
              ...options,
              propertySchema: propertySchema.additionalProperties,
            });
            Object.assign(generatedVariables, propertyGeneratedVariables);
            Object.entries(propertyImports).forEach(
              ([path, importVariables]) => {
                if (!(path in imports)) {
                  imports[path] = [];
                }
                imports[path].push(
                  ...importVariables.filter((importVariable) => {
                    return !imports[path].includes(importVariable);
                  })
                );
              }
            );

            const propertyModels =
              getModelsReferencedByPropertyType(propertyType);
            referencedSchemas.push(
              ...propertyModels.filter((modelName) => {
                return (
                  !primitiveTypeModels.includes(modelName as any) &&
                  !referencedSchemas.includes(modelName as any)
                );
              })
            );
            const decorators = [...propertySchemaCodeConfiguration.decorators];
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'AdditionalProperties',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
            if (
              typeof propertySchema.additionalProperties === 'object' &&
              '$ref' in propertySchema.additionalProperties
            ) {
              const referencedSchemaName =
                propertySchema.additionalProperties.$ref.replace(
                  '#/components/schemas/',
                  ''
                );
              decorators.push(`@AdditionalProperties(${referencedSchemaName})`);
            } else if (
              typeof propertySchema.additionalProperties === 'object' &&
              'type' in propertySchema.additionalProperties &&
              propertySchema.additionalProperties.type === 'array' &&
              propertySchema.additionalProperties.items &&
              '$ref' in propertySchema.additionalProperties.items
            ) {
              const referencedSchemaName =
                propertySchema.additionalProperties.items.$ref.replace(
                  '#/components/schemas/',
                  ''
                );
              const serializedAdditionalProperties = JSON.stringify(
                propertySchema.additionalProperties,
                null,
                2
              ).replace(
                /"items"\:\s*\{[\s\S]*?\}/gm,
                `"items": { "type": ${referencedSchemaName}}`
              );

              decorators.push(
                `@AdditionalProperties(${serializedAdditionalProperties})`
              );
            } else {
              decorators.push(
                `@AdditionalProperties(${JSON.stringify(
                  propertySchema.additionalProperties,
                  null,
                  2
                )})`
              );
            }
            return {
              ...propertySchemaCodeConfiguration,
              propertyType: `Record<string, ${propertyType}>`,
              zodCodeString: `z.record(${zodCodeString})`,
              decorators,
            };
          }
          return propertySchemaCodeConfiguration;
        case 'array':
          if (propertySchema.items) {
            const {
              propertyType,
              zodCodeString,
              decorators: itemDecorators,
              imports: propertyImports,
              generatedVariables: propertyGeneratedVariables,
            } = generatePropertySchemaCode({
              ...options,
              propertySchema: propertySchema.items,
            });
            Object.assign(generatedVariables, propertyGeneratedVariables);

            Object.entries(propertyImports).forEach(
              ([path, importVariables]) => {
                if (!(path in imports)) {
                  imports[path] = [];
                }
                imports[path].push(
                  ...importVariables.filter((importVariable) => {
                    return !imports[path].includes(importVariable);
                  })
                );
              }
            );
            const isEnum = 'enum' in propertySchema.items;

            const decorators = [...propertySchemaCodeConfiguration.decorators];
            decorators.push(
              ...itemDecorators.filter((decorator) => {
                return !decorators.includes(decorator);
              })
            );

            if (!isEnum) {
              const propertyModels =
                getModelsReferencedByPropertyType(propertyType);

              referencedSchemas.push(
                ...propertyModels.filter((modelName) => {
                  return (
                    !primitiveTypeModels.includes(modelName as any) &&
                    !referencedSchemas.includes(modelName as any)
                  );
                })
              );
              if (generateTsEDControllers) {
                addModuleImport({
                  imports,
                  importName: 'ArrayOf',
                  importFilePath: TSED_SCHEMA_LIBRARY_PATH,
                });
              }
              if (propertyModels.length === 1) {
                decorators.push(`@ArrayOf(${propertyModels[0]})`);
              }
            }
            return {
              ...propertySchemaCodeConfiguration,
              propertyType: `(${propertyType})[]`,
              zodCodeString: `z.array(${zodCodeString})`,
              decorators,
            };
          }
          return {
            ...propertySchemaCodeConfiguration,
            propertyType: `any[]`,
            zodCodeString: `z.array(z.any())`,
          };
      }
    })();
    if (decorators) {
      propertySchemaCodeConfiguration.decorators.push(...decorators);
    }
    Object.assign(propertySchemaCodeConfiguration, rest);
  } else if ('oneOf' in propertySchema) {
    const propertySchemas = propertySchema.oneOf.map((oneOfPropertySchema) => {
      return generatePropertySchemaCode({
        ...options,
        propertySchema: oneOfPropertySchema,
      });
    });

    const propertyTypes = propertySchemas.map(
      ({ propertyType }) => propertyType
    );
    const propertyModels = propertyTypes.flatMap((propertyType) => {
      return getModelsReferencedByPropertyType(propertyType);
    });
    propertySchemaCodeConfiguration.decorators.push(
      `@OneOf(${propertyModels.join(', ')})`
    );
    propertySchemaCodeConfiguration.propertyType = propertyTypes.join(' | ');
    referencedSchemas.push(
      ...propertyModels.filter((modelName) => {
        return (
          !primitiveTypeModels.includes(modelName as any) &&
          !referencedSchemas.includes(modelName as any)
        );
      })
    );

    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'OneOf',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }

    propertySchemaCodeConfiguration.zodCodeString =
      propertySchemas.length > 1
        ? `z.union([${propertySchemas
            .map(({ zodCodeString }) => zodCodeString)
            .join(',')}])`
        : propertySchemas[0].zodCodeString;
    propertySchemas.forEach(
      ({ generatedVariables: propertyGeneratedVariables }) => {
        Object.assign(generatedVariables, propertyGeneratedVariables);
      }
    );
  } else if ('anyOf' in propertySchema) {
    const propertySchemas = propertySchema.anyOf.map((anyOfPropertySchema) => {
      return generatePropertySchemaCode({
        ...options,
        propertySchema: anyOfPropertySchema,
      });
    });

    const propertyTypes = propertySchemas.map(
      ({ propertyType }) => propertyType
    );
    const propertyModels = propertyTypes.flatMap((propertyType) => {
      return getModelsReferencedByPropertyType(propertyType);
    });
    propertySchemaCodeConfiguration.decorators.push(
      `@AnyOf(${propertyModels.join(', ')})`
    );
    propertySchemaCodeConfiguration.propertyType = propertyTypes.join(' | ');
    referencedSchemas.push(
      ...propertyModels.filter((modelName) => {
        return (
          !primitiveTypeModels.includes(modelName as any) &&
          !referencedSchemas.includes(modelName as any)
        );
      })
    );

    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'AnyOf',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }

    propertySchemaCodeConfiguration.zodCodeString =
      propertySchemas.length > 1 ? `z.any()` : propertySchemas[0].zodCodeString;
    propertySchemas.forEach(
      ({ generatedVariables: propertyGeneratedVariables }) => {
        Object.assign(generatedVariables, propertyGeneratedVariables);
      }
    );
  }

  if (propertySchemaCodeConfiguration.required) {
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'Required',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
    if (!propertySchemaCodeConfiguration.decorators.includes(`@Required()`)) {
      propertySchemaCodeConfiguration.decorators.push(`@Required()`);
    }
  }

  return {
    ...propertySchemaCodeConfiguration,
    referencedSchemas,
    imports,
    generatedVariables,
  };
};

/**
 * Gets the models referenced by a property type
 *
 * @param propertyType The property type to get the models referenced by
 * @returns The models referenced by the property type
 */
export const getModelsReferencedByPropertyType = (propertyType: string) => {
  return propertyType
    .replace(/\[\]$/g, '')
    .replace(/^\(|\)$/g, '')
    .split(' | ')
    .filter((propertyType) => {
      return propertyType != 'any';
    })
    .map((propertyType) => {
      if (propertyType.match(/".+"/g)) {
        return 'String';
      }
      return (primitiveTypeToModelMapping as any)[propertyType] ?? propertyType;
    });
};
