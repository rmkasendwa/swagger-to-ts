import { isEmpty } from 'lodash';

import { OpenAPISpecification } from '../models';
import {
  GeneratedSchemaCodeConfiguration,
  RequestGroupings,
  ZodValidationSchemaProperty,
} from '../models/TypescriptAPIGenerator';
import { findSchemaReferencedSchemas } from './FindSchemaReferencedSchemas';

//#region Generate model mappings
export interface GenerateModelMappingsOptions {
  swaggerDocs: OpenAPISpecification;
  requestGroupings: RequestGroupings;
}
export const generateModelMappings = ({
  requestGroupings,
  swaggerDocs,
}: GenerateModelMappingsOptions) => {
  //#region Find all Schemas referenced in the requests
  const schemaEntityReferences = Object.values(requestGroupings).reduce(
    (accumulator, { requests }) => {
      requests.forEach(({ tags, responses, requestBody }) => {
        [
          ...Object.values(responses),
          ...(() => {
            if (requestBody) {
              return [requestBody];
            }
            return [];
          })(),
        ].forEach(({ content }) => {
          if (
            'application/json' in content &&
            '$ref' in content['application/json'].schema
          ) {
            const schemaReference = content['application/json'].schema.$ref;
            const schemaName = schemaReference.split('/').pop()!;
            const schemaNames = [
              schemaName,
              ...findSchemaReferencedSchemas({
                schemaName,
                swaggerDocs,
              }),
            ];
            schemaNames.forEach((schemaName) => {
              if (!accumulator[schemaName]) {
                accumulator[schemaName] = [];
              }
              tags.forEach((tag) => {
                if (!accumulator[schemaName].includes(tag)) {
                  accumulator[schemaName].push(tag);
                }
              });
            });
          }
        });
      });
      return accumulator;
    },
    {} as Record<string, string[]>
  );
  //#endregion

  //#region Generate Schema to entity mappings
  const schemaEntityMappings = Object.keys(schemaEntityReferences).reduce(
    (accumulator, schemaName) => {
      if (schemaEntityReferences[schemaName].length === 1) {
        accumulator[schemaName] = schemaEntityReferences[schemaName][0];
      } else {
        accumulator[schemaName] = 'Utils';
      }
      return accumulator;
    },
    {} as Record<string, string>
  );
  //#endregion

  //#region Map schema references to entities
  const entitySchemaGroups = Object.keys(schemaEntityReferences).reduce(
    (accumulator, schemaName) => {
      if (schemaEntityReferences[schemaName].length === 1) {
        schemaEntityReferences[schemaName].forEach((entityName) => {
          if (!accumulator[entityName]) {
            accumulator[entityName] = [];
          }
          accumulator[entityName].push(schemaName);
        });
      } else {
        const utilsEntityName = 'Utils';
        if (!accumulator[utilsEntityName]) {
          accumulator[utilsEntityName] = [];
        }
        accumulator[utilsEntityName].push(schemaName);
      }
      return accumulator;
    },
    {} as Record<string, string[]>
  );
  //#endregion

  //#region Generate validation schemas code
  const models = Object.keys(entitySchemaGroups)
    .sort()
    .reduce(
      (accumulator, entityName) => {
        entitySchemaGroups[entityName].sort().forEach((schemaName) => {
          if (!accumulator[entityName]) {
            accumulator[entityName] = {
              models: {},
            };
          }
          const {
            generatedVariables,
            zodValidationSchemaCode,
            zodValidationSchemaConfiguration,
            referencedSchemas,
            inferedTypeCode,
            zodValidationSchemaName,
            imports,
          } = generateModelCode({
            schemaName,
            swaggerDocs,
          });

          referencedSchemas.forEach((referencedSchemaName) => {
            const referencedSchemaEntityName =
              schemaEntityMappings[referencedSchemaName];
            if (referencedSchemaEntityName != entityName) {
              const importFilePath = `./${referencedSchemaEntityName}`;
              if (!imports[importFilePath]) {
                imports[importFilePath] = [];
              }
              imports[importFilePath].push(referencedSchemaName);
            }
          });

          accumulator[entityName].models[schemaName] = {
            name: schemaName,
            zodValidationSchemaCode,
            zodValidationSchemaConfiguration,
            zodValidationSchemaName,
            inferedTypeCode,
            generatedVariables,
            imports,
            ...(() => {
              if (referencedSchemas.length > 0) {
                return {
                  referencedSchemas,
                };
              }
            })(),
          };

          if (imports) {
            if (!accumulator[entityName].imports) {
              accumulator[entityName].imports = {};
            }
            Object.keys(imports).forEach((importFilePath) => {
              if (!accumulator[entityName].imports![importFilePath]) {
                accumulator[entityName].imports![importFilePath] = [];
              }
              imports[importFilePath].forEach((importName) => {
                if (
                  !accumulator[entityName].imports![importFilePath]!.includes(
                    importName
                  )
                ) {
                  accumulator[entityName].imports![importFilePath]!.push(
                    importName
                  );
                }
              });
            });
          }
        });
        return accumulator;
      },
      {} as Record<
        string,
        {
          models: Record<string, GeneratedSchemaCodeConfiguration>;
          imports?: Record<string, string[]>;
        }
      >
    );
  //#endregion

  return {
    entitySchemaGroups,
    schemaEntityMappings,
    schemaEntityReferences,
    models,
  };
};
//#endregion

//#region Generate model code
export interface GenerateModelCodeOptions {
  swaggerDocs: OpenAPISpecification;
  schemaName: string;
}
export const generateModelCode = ({
  schemaName,
  swaggerDocs,
}: GenerateModelCodeOptions) => {
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
        const code = (() => {
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
        })();
        if (
          code &&
          (!schema.required || !schema.required.includes(propertyName))
        ) {
          return `${code}.nullish()`;
        }
        return code;
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
//#endregion
