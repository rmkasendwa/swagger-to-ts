import { ObjectSchema } from '../../models/OpenAPISpecification/Schema';
import { SchemaCodeConfiguration, SchemaCodeGeneratorFunction } from './models';

/**
 * Generates string schema code for a given schema
 *
 * @param options The options to generate string schema code
 * @returns The generated string schema code
 */
export const generateObjectSchemaCode: SchemaCodeGeneratorFunction<
  ObjectSchema
> = ({ schema, propertyName, isPropertyRequired }) => {
  const zodCodeString = (() => {
    return `z.any()`;
  })();

  const required = isPropertyRequired;
  const baseTsedPropertyDecorators = [`@Property()`];
  const baseTsedProperty: Omit<
    SchemaCodeConfiguration,
    'propertyType' | 'propertyModels'
  > = {
    openAPISpecification: schema,
    propertyName,
    accessModifier: 'public',
    decorators: baseTsedPropertyDecorators,
    required,
    zodCodeString,
  };

  const decorators = [...baseTsedPropertyDecorators];

  return {
    ...baseTsedProperty,
    decorators,
    propertyType: `string`,
    propertyModels: [`String`],
  };
};
