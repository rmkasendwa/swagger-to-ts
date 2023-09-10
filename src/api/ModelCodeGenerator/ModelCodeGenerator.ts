import { isEmpty } from 'lodash';

import { ModuleImports, OpenAPISpecification } from '../../models';
import { generateBooleanSchemaCode } from './BooleanSchemaCodeGenerator';
import {
  SchemaCodeConfiguration,
  SchemaCodeGeneratorFunctionOptions,
} from './models';
import { generateNullSchemaCode } from './NullSchemaCodeGenerator';
import { generateNumberSchemaCode } from './NumberSchemaCodeGenerator';
import { generateStringSchemaCode } from './StringSchemaCodeGenerator';

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
    let modelIsRecursive = false;

    const modelPropertiesCodeConfiguration = Object.entries(
      schema.properties
    ).map(([propertyName, propertySchema]) => {
      const propertySchemaCodeConfiguration: SchemaCodeConfiguration = {
        openAPISpecification: schema,
        propertyName,
        accessModifier: 'public',
        decorators: [`@Property()`],
        required: Boolean(schema.required?.includes(propertyName)),
        zodCodeString: `z.any()`,
        propertyModels: [],
        propertyType: `any`,
      };

      if ('$ref' in propertySchema) {
        const referencedSchemaName = propertySchema.$ref.replace(
          '#/components/schemas/',
          ''
        );
        referencedSchemas.push(referencedSchemaName);
        propertySchemaCodeConfiguration.propertyModels.push(
          referencedSchemaName
        );
        propertySchemaCodeConfiguration.propertyType = referencedSchemaName;
        propertySchemaCodeConfiguration.zodCodeString = `${referencedSchemaName}ValidationSchema`;
      } else if ('type' in propertySchema) {
        const { decorators, ...rest } =
          ((): Partial<SchemaCodeConfiguration> => {
            const baseOptions: SchemaCodeGeneratorFunctionOptions<
              typeof propertySchema
            > = {
              generatedVariables,
              generateTsEDControllers,
              imports,
              propertyName,
              schemaName,
              schema: propertySchema,
            };
            switch (propertySchema.type) {
              case 'string':
                return generateStringSchemaCode({
                  ...baseOptions,
                  schema: propertySchema,
                });
              case 'boolean':
                return generateBooleanSchemaCode({
                  ...baseOptions,
                  schema: propertySchema,
                });
              case 'integer':
              case 'number':
                return generateNumberSchemaCode({
                  ...baseOptions,
                  schema: propertySchema,
                });
              case 'null':
                return generateNullSchemaCode({
                  ...baseOptions,
                  schema: propertySchema,
                });
            }
            return {};
          })();
        if (decorators) {
          propertySchemaCodeConfiguration.decorators.push(...decorators);
        }
        Object.assign(propertySchemaCodeConfiguration, rest);
      }

      return propertySchemaCodeConfiguration;
    });

    const zodObjectPropertiesCode = Object.entries(
      modelPropertiesCodeConfiguration
    )
      .map(([propertyName, { zodCodeString }]) => {
        return `'${propertyName}': ${zodCodeString}`;
      })
      .join(',\n');

    const zodValidationSchemaCode = `export const ${zodValidationSchemaName} = z.object({${zodObjectPropertiesCode}})`;

    const tsedModelPropertiesCode = Object.entries(
      modelPropertiesCodeConfiguration
    )
      .map(
        ([
          propertyName,
          { decorators, accessModifier, propertyType, required, isNullable },
        ]) => {
          const propertyTypeCode = isNullable
            ? `${propertyType} | null`
            : propertyType;
          const propertyValueSeparator = required ? '!:' : '?:';
          const typeDefinitionSnippet = `
          ${decorators.join('\n')}
          ${accessModifier} ${propertyName}${propertyValueSeparator} ${propertyTypeCode}
        `.trimIndent();
          return typeDefinitionSnippet;
        }
      )
      .join(';\n\n');

    const tsedModelCode = `
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
          const interfacePropertiesCode = Object.entries(
            modelPropertiesCodeConfiguration
          )
            .map(
              ([
                propertyName,
                { propertyType, required, openAPISpecification, isNullable },
              ]) => {
                const propertiesTypeCode = isNullable
                  ? `${propertyType} | null`
                  : propertyType;
                const propertyValueSeparator =
                  required && propertiesTypeCode !== 'any' ? ': ' : '?: ';
                const propertyValueSnippet = `${propertyName}${propertyValueSeparator} ${propertiesTypeCode}`;
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
