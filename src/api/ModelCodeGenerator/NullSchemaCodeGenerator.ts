import { NullSchema } from '../../models/OpenAPISpecification/Schema';
import { SchemaCodeGeneratorFunction } from './models';

/**
 * Generates null schema code for a given schema
 *
 * @param options The options to generate null schema code
 * @returns The generated null schema code
 */
export const generateNullSchemaCode: SchemaCodeGeneratorFunction<
  NullSchema
> = ({ schema, propertyName, isPropertyRequired }) => {
  return {
    openAPISpecification: schema,
    propertyName,
    accessModifier: 'public',
    decorators: [`@Property()`],
    required: isPropertyRequired,
    zodCodeString: `z.null()`,
    propertyType: `null`,
    propertyModels: [`Boolean`],
  };
};
