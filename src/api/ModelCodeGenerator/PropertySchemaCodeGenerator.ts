import { ModuleImports } from '../../models';
import { ObjectSchema, Schema } from '../../models/OpenAPISpecification/Schema';
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
    decorators: [`@Property()`],
    required: Boolean(schema.required?.includes(propertyName)),
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
        case 'array':
          if (propertySchema.items) {
            const {
              referencedSchemas,
              imports,
              generatedVariables,
              propertyType,
              zodCodeString,
              propertyModels,
              ...propertySchemaCodeConfiguration
            } = generatePropertySchemaCode({
              ...options,
              propertySchema: propertySchema.items,
            });

            return {
              ...propertySchemaCodeConfiguration,
              propertyType: `${propertyType}[]`,
              zodCodeString: `z.array(${zodCodeString})`,
              decorators: [`@Array(${(propertyModels || []).join(',')})`],
            };
          }
          return {
            ...propertySchemaCodeConfiguration,
            propertyType: `any[]`,
            zodCodeString: `z.array(z.any())`,
            decorators: [`@Array()`],
          };
      }
      return {};
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
    propertySchemaCodeConfiguration.propertyType = propertySchemas
      .map(({ propertyType }) => propertyType)
      .join(' | ');
    propertySchemaCodeConfiguration.zodCodeString = `z.union([${propertySchemas
      .map(({ zodCodeString }) => zodCodeString)
      .join(',')}])`;
  }

  return {
    ...propertySchemaCodeConfiguration,
    referencedSchemas,
    imports,
    generatedVariables,
  };
};
