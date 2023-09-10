import { BooleanSchema } from '../../models/OpenAPISpecification/Schema';
import { SchemaCodeGeneratorFunction } from './models';

/**
 * Generates boolean schema code for a given schema
 *
 * @param options The options to generate boolean schema code
 * @returns The generated boolean schema code
 */
export const generateBooleanSchemaCode: SchemaCodeGeneratorFunction<
  BooleanSchema
> = ({ schema, propertyName, isPropertyRequired }) => {
  return {
    openAPISpecification: schema,
    propertyName,
    accessModifier: 'public',
    decorators: [`@Property()`],
    required: isPropertyRequired,
    zodCodeString: `z.boolean()`,
    propertyType: `boolean`,
    propertyModels: [`Boolean`],
  };
};
