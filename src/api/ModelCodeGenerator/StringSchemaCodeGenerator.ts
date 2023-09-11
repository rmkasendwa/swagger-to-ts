import pluralize from 'pluralize';

import { TSED_SCHEMA_LIBRARY_PATH } from '../../models';
import { StringSchema } from '../../models/OpenAPISpecification/Schema';
import { addModuleImport } from '../Utils';
import { SchemaCodeGeneratorFunction } from './models';

/**
 * Generates string schema code for a given schema
 *
 * @param options The options to generate string schema code
 * @returns The generated string schema code
 */
export const generateStringSchemaCode: SchemaCodeGeneratorFunction<
  StringSchema
> = ({
  schema,
  propertyName,
  schemaName,
  generatedVariables,
  generateTsEDControllers,
  imports,
}) => {
  const enumTypeName = pluralize
    .singular(`${schemaName} ${propertyName}`)
    .toPascalCase();
  const enumValuesName = `${enumTypeName.toCamelCase()}Options`;
  let propertyType = `string`;

  const zodCodeString = (() => {
    if (schema.enum && schema.enum.length > 0) {
      if (schema.enum.length === 1) {
        propertyType = JSON.stringify(schema.enum[0]);
        return `z.literal(${propertyType})`;
      }
      generatedVariables[
        enumValuesName
      ] = `export const ${enumValuesName} = ${JSON.stringify(
        schema.enum
      )} as const`;

      generatedVariables[
        enumTypeName
      ] = `export type ${enumTypeName} = (typeof ${enumValuesName})[number]`;

      return `z.enum(${enumValuesName})`;
    } else {
      let validationCode = `z.string()`;
      if (schema.minLength != null) {
        validationCode += `.min(${schema.minLength})`;
      }
      if (schema.maxLength != null) {
        validationCode += `.max(${schema.maxLength})`;
      }
      return validationCode;
    }
  })();

  const baseTsedPropertyDecorators: string[] = [];

  if (schema.enum && schema.enum.length > 1) {
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'Enum',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
    return {
      decorators: [
        ...baseTsedPropertyDecorators,
        `@Enum(...${enumValuesName})`,
      ],
      propertyType: enumTypeName,
      zodCodeString,
    };
  }

  if (schema.format) {
    switch (schema.format) {
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

  if (schema.minLength != null) {
    baseTsedPropertyDecorators.push(`@MinLength(${schema.minLength})`);
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'MinLength',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
  }

  if (schema.maxLength != null) {
    baseTsedPropertyDecorators.push(`@MaxLength(${schema.maxLength})`);
    if (generateTsEDControllers) {
      addModuleImport({
        imports,
        importName: 'MaxLength',
        importFilePath: TSED_SCHEMA_LIBRARY_PATH,
      });
    }
  }

  return {
    decorators: baseTsedPropertyDecorators,
    propertyType,
    zodCodeString,
  };
};
