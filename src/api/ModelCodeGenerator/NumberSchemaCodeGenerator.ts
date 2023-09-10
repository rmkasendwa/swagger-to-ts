import { TSED_SCHEMA_LIBRARY_PATH } from '../../models';
import { NumberSchema } from '../../models/OpenAPISpecification/Schema';
import { addModuleImport } from '../Utils';
import { SchemaCodeConfiguration, SchemaCodeGeneratorFunction } from './models';

/**
 * Generates number schema code for a given schema
 *
 * @param options The options to generate number schema code
 * @returns The generated number schema code
 */
export const generateNumberSchemaCode: SchemaCodeGeneratorFunction<
  NumberSchema
> = ({
  schema,
  propertyName,
  isPropertyRequired,
  generateTsEDControllers,
  imports,
}) => {
  const zodCodeString = (() => {
    let validationCode = `z.number()`;
    if (schema.min != null) {
      validationCode += `.min(${schema.min})`;
    }
    if (schema.max != null) {
      validationCode += `.max(${schema.max})`;
    }
    return validationCode;
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
    ...baseTsedProperty,
    decorators,
    propertyType: `number`,
    propertyModels: [`Number`],
  };
};
