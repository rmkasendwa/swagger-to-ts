import { isEmpty } from 'lodash';

import {
  ModuleImports,
  OpenAPISpecification,
  TSED_SCHEMA_LIBRARY_PATH,
} from '../../models';
import { addModuleImport } from '../Utils';
import {
  generatePropertySchemaCode,
  getModelsReferencedByPropertyType,
} from './PropertySchemaCodeGenerator';

//#region Generate model code
export interface GenerateModelCodeOptions {
  /**
   * The open api specification to use when looking up schemas
   */
  openAPISpecification: OpenAPISpecification;

  /**
   * The name of the schema to generate code for
   */
  schemaName: string;

  /**
   * Whether to generate code for tsed controllers
   */
  generateTsEDControllers?: boolean;

  /**
   * Whether to infer the type from the validation schema
   */
  inferTypeFromValidationSchema?: boolean;
}

/**
 * Generates model code for a given schema
 *
 * @param options The options to generate model code.
 * @returns The generated model code
 */
export const generateModelCode = ({
  schemaName,
  openAPISpecification,
  generateTsEDControllers,
  inferTypeFromValidationSchema = true,
}: GenerateModelCodeOptions) => {
  const schema = openAPISpecification.components.schemas[schemaName];
  if (
    'type' in schema &&
    schema.type === 'object' &&
    'properties' in schema &&
    schema.properties
  ) {
    const referencedSchemas: string[] = [];
    const generatedVariables: Record<string, string> = {};
    const zodValidationSchemaName = `${schemaName}ValidationSchema`;
    const inferedTypeCode = `export type ${schemaName} = z.infer<typeof ${zodValidationSchemaName}>`;
    const imports: ModuleImports = {
      zod: ['z'],
    };

    const modelPropertiesCodeConfiguration = Object.entries(
      schema.properties
    ).map(([propertyName, propertySchema]) => {
      const {
        referencedSchemas: propertyReferencedSchemas,
        imports: propertyImports,
        generatedVariables: propertyGeneratedVariables,
        ...propertySchemaCodeConfiguration
      } = generatePropertySchemaCode({
        schema,
        schemaName,
        propertySchema,
        propertyName,
        generateTsEDControllers,
      });
      referencedSchemas.push(...propertyReferencedSchemas);
      Object.entries(propertyImports).forEach(([path, importVariables]) => {
        if (!(path in imports)) {
          imports[path] = [];
        }
        imports[path].push(
          ...importVariables.filter((importVariable) => {
            return !imports[path].includes(importVariable);
          })
        );
      });
      Object.assign(generatedVariables, propertyGeneratedVariables);
      return propertySchemaCodeConfiguration;
    });

    const modelIsRecursive = referencedSchemas.includes(schemaName);
    const zodObjectPropertiesCode = modelPropertiesCodeConfiguration
      .map(
        ({
          propertyName,
          zodCodeString: baseZodCodeString,
          required,
          isNullable,
          openAPISpecification,
        }) => {
          let zodCodeString = baseZodCodeString;
          required || (zodCodeString += '.optional()');
          isNullable && (zodCodeString += '.nullable()');
          openAPISpecification.description &&
            (zodCodeString += `.describe(${JSON.stringify(
              openAPISpecification.description
            )})`);
          return `'${propertyName}': ${zodCodeString}`;
        }
      )
      .join(',\n');

    const zodValidationSchemaCode = modelIsRecursive
      ? `export const ${zodValidationSchemaName}: z.ZodType<${schemaName}> = z.lazy(() => z.object({${zodObjectPropertiesCode}}))`
      : `export const ${zodValidationSchemaName} = z.object({${zodObjectPropertiesCode}})`;

    const tsedModelPropertiesCode = modelPropertiesCodeConfiguration
      .map(
        ({
          decorators,
          accessModifier,
          propertyType,
          required,
          isNullable,
          propertyName: basePropertyName,
          openAPISpecification,
        }) => {
          if (generateTsEDControllers) {
            addModuleImport({
              imports,
              importName: 'Property',
              importFilePath: TSED_SCHEMA_LIBRARY_PATH,
            });
          }
          const propertyDecorators = ['@Property()', ...decorators];

          if (openAPISpecification.description) {
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'Description',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
            propertyDecorators.push(
              `@Description(${JSON.stringify(
                openAPISpecification.description
              )})`
            );
          }

          if (
            'example' in openAPISpecification &&
            openAPISpecification.example
          ) {
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'Example',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
            propertyDecorators.push(
              `@Example(${JSON.stringify(openAPISpecification.example)})`
            );
          }

          if (
            'default' in openAPISpecification &&
            openAPISpecification.default
          ) {
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'Default',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
            propertyDecorators.push(
              `@Default(${JSON.stringify(openAPISpecification.default)})`
            );
          }

          if (isNullable) {
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'Nullable',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
            const nullableModel = (() => {
              if ('enum' in openAPISpecification) {
                return 'String';
              }
              return getModelsReferencedByPropertyType(propertyType)[0];
            })();
            propertyDecorators.push(`@Nullable(${nullableModel})`);
          }

          const propertyName = (() => {
            if (basePropertyName.match(/\W/g)) {
              if (generateTsEDControllers) {
                return basePropertyName.toCamelCase();
              } else {
                return `'${basePropertyName}'`;
              }
            }
            return basePropertyName;
          })();

          if (basePropertyName.match(/\W/g)) {
            propertyDecorators.push(`@Name('${basePropertyName}')`);
            if (generateTsEDControllers) {
              addModuleImport({
                imports,
                importName: 'Name',
                importFilePath: TSED_SCHEMA_LIBRARY_PATH,
              });
            }
          }

          const propertyTypeCode = isNullable
            ? `${propertyType} | null`
            : propertyType;
          const propertyValueSeparator = required ? '!:' : '?:';
          const typeDefinitionSnippet = `
          ${propertyDecorators.join('\n')}
          ${accessModifier} ${propertyName}${propertyValueSeparator} ${propertyTypeCode}
        `.trimIndent();
          return typeDefinitionSnippet;
        }
      )
      .join(';\n\n');

    const modelDecorators: string[] = [];
    if (schema.description) {
      if (generateTsEDControllers) {
        addModuleImport({
          imports,
          importName: 'Description',
          importFilePath: TSED_SCHEMA_LIBRARY_PATH,
        });
      }
      modelDecorators.push(
        `@Description(${JSON.stringify(schema.description)})`
      );
    }

    const tsedModelCode = `
      ${modelDecorators.join('\n')}
      export class ${schemaName} {
        ${tsedModelPropertiesCode}
      }
    `.trimIndent();

    const schemaCode = [
      ...(() => {
        if (!isEmpty(generatedVariables)) {
          return Object.values(generatedVariables);
        }
        return [];
      })(),
      zodValidationSchemaCode,
      ...(() => {
        if (generateTsEDControllers && tsedModelCode) {
          return [tsedModelCode];
        }
        if (!inferTypeFromValidationSchema || modelIsRecursive) {
          const interfacePropertiesCode = modelPropertiesCodeConfiguration
            .map(
              ({
                propertyName,
                propertyType,
                required,
                openAPISpecification,
                isNullable,
              }) => {
                const propertiesTypeCode = isNullable
                  ? `${propertyType} | null`
                  : propertyType;
                const propertyValueSeparator =
                  required && propertiesTypeCode !== 'any' ? ': ' : '?: ';
                const propertyValueSnippet = `'${propertyName}'${propertyValueSeparator} ${propertiesTypeCode}`;
                const jsDocCommentLines: string[] = [];
                if (
                  'description' in openAPISpecification &&
                  openAPISpecification.description
                ) {
                  jsDocCommentLines.push(openAPISpecification.description);
                }
                if (
                  'example' in openAPISpecification &&
                  openAPISpecification.example
                ) {
                  if (typeof openAPISpecification.example === 'object') {
                    jsDocCommentLines.push(
                      `@example\n\`\`\`json\n${JSON.stringify(
                        openAPISpecification.example,
                        null,
                        2
                      )}\n\`\`\``
                    );
                  } else {
                    jsDocCommentLines.push(
                      `@example ${JSON.stringify(openAPISpecification.example)}`
                    );
                  }
                }
                if (
                  'default' in openAPISpecification &&
                  openAPISpecification.default
                ) {
                  jsDocCommentLines.push(
                    `@default ${JSON.stringify(openAPISpecification.default)}`
                  );
                }

                if (jsDocCommentLines.length > 0) {
                  const linesString = jsDocCommentLines
                    .reduce((acumulator, line) => {
                      acumulator.push(line);
                      return acumulator;
                    }, [] as string[])
                    .map((line) => {
                      return line
                        .split('\n')
                        .map((lineSlice) => ` * ${lineSlice}`)
                        .join('\n');
                    })
                    .join('\n *\n');
                  const jsDocCommentCode = `
                  /**
                   ${linesString}
                  */
                `.trimIndent();

                  return `${jsDocCommentCode}\n${propertyValueSnippet}`;
                }

                return propertyValueSnippet;
              }
            )
            .join(';\n\n');

          const interfaceCode = `
          export interface ${schemaName} {
            ${interfacePropertiesCode}
          }
        `.trimIndent();

          return [interfaceCode];
        }
        return [inferedTypeCode];
      })(),
    ].join('\n\n');

    return {
      zodValidationSchemaCode: `
      //#region ${schemaName}
      ${schemaCode}
      //#endregion
    `.trimIndent(),
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
      ...(() => {
        if (generateTsEDControllers) {
          return {
            tsedModelCode,
            tsedModelName: schemaName,
          };
        }
      })(),
    };
  }
};
//#endregion
