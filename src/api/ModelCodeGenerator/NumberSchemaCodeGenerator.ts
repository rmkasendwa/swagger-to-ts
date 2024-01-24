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
  const min = schema.min ?? schema.minimum;
  const max = schema.max ?? schema.maximum;

  if (min != null) {
    decorators.push(`@Min(${min})`);
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'Min',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
  }

  if (max != null) {
    decorators.push(`@Max(${max})`);
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
      if (min != null) {
        validationCode += `.min(${min})`;
      }
      if (max != null) {
        validationCode += `.max(${max})`;
      }
      return validationCode;
    })(),
  };
};
