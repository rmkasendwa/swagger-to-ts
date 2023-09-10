import { TSED_SCHEMA_LIBRARY_PATH } from '../../models';
import { NumberSchema } from '../../models/OpenAPISpecification/Schema';
import { addModuleImport } from '../Utils';
import { SchemaCodeGeneratorFunction } from './models';

/**
 * Generates number schema code for a given schema
 *
 * @param options The options to generate number schema code
 * @returns The generated number schema code
 */
export const generateNumberSchemaCode: SchemaCodeGeneratorFunction<
  NumberSchema
> = ({ schema, generateTsEDControllers, imports }) => {
  const decorators: string[] = [];

  if (schema.min != null) {
    decorators.push(`@Min(${schema.min})`);
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'Min',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
  }

  if (schema.max != null) {
    decorators.push(`@Max(${schema.min})`);
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'Max',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
  }

  return {
    decorators,
    propertyType: `number`,
    zodCodeString: (() => {
      let validationCode = `z.number()`;
      if (schema.min != null) {
        validationCode += `.min(${schema.min})`;
      }
      if (schema.max != null) {
        validationCode += `.max(${schema.max})`;
      }
      return validationCode;
    })(),
  };
};
