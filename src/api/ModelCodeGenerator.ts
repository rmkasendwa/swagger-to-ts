import { isEmpty } from 'lodash';

import { OpenAPISpecification } from '../models';
import { ZodValidationSchemaProperty } from '../models/TypescriptAPIGenerator';

export interface GenerateSchemaCodeOptions {
  swaggerDocs: OpenAPISpecification;
  schemaName: string;
}
export const generateSchemaCode = ({
  schemaName,
  swaggerDocs,
}: GenerateSchemaCodeOptions) => {
  const schema = swaggerDocs.components.schemas[schemaName];
  const referencedSchemas: string[] = [];
  const generatedVariables: Record<string, string> = {};
  const zodValidationSchemaName = `${schemaName}ValidationSchema`;
  const inferedTypeCode = `export type ${schemaName} = z.infer<typeof ${zodValidationSchemaName}>`;
  const imports: Record<string, string[]> = {
    zod: ['z'],
  };

  const zodValidationSchemaConfiguration = Object.keys(
    schema.properties
  ).reduce((accumulator, propertyName) => {
    const code = (() => {
      const property = schema.properties[propertyName];
      if ('type' in property) {
        switch (property.type) {
          case 'array': {
            if ('$ref' in property.items) {
              const schemaName = property.items.$ref.split('/').pop()!;
              referencedSchemas.push(schemaName);
              return `z.array(${schemaName}ValidationSchema)`;
            }
            break;
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
      }
    })();
    if (code) {
      accumulator[propertyName] = {
        code,
      };
    }
    return accumulator;
  }, {} as Record<string, ZodValidationSchemaProperty>);

  const zodObjectPropertiesCode = Object.keys(zodValidationSchemaConfiguration)
    .map((key) => {
      return `${key}: ${zodValidationSchemaConfiguration[key].code}`;
    })
    .join(',\n');

  const code = [
    ...(() => {
      if (!isEmpty(generatedVariables)) {
        return Object.values(generatedVariables);
      }
      return [];
    })(),
    `export const ${zodValidationSchemaName} = z.object({${zodObjectPropertiesCode}})`,
    inferedTypeCode,
  ].join('\n\n');

  return {
    zodValidationSchemaCode: `
      //#region ${schemaName}
      ${code}
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
  };
};
