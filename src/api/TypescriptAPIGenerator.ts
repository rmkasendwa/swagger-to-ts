import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';
import prettier from 'prettier';

import { OpenAPISpecification } from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  GeneratedSchemaCodeConfiguration,
  TypescriptAPIGeneratorRequest,
} from '../models/TypescriptAPIGenerator';
import { findSchemaReferencedSchemas } from './FindSchemaReferencedSchemas';
import { generateSchemaCode } from './SchemaCodeGenerator';

export interface GenerateTypescriptAPIConfig {
  swaggerDocs: OpenAPISpecification;
  outputRootPath: string;
  outputInternalState?: boolean;
}

export const generateTypescriptAPI = async ({
  swaggerDocs,
  outputRootPath,
  outputInternalState = false,
}: GenerateTypescriptAPIConfig) => {
  // Find all requests
  const requestGroupings = Object.keys(swaggerDocs.paths).reduce(
    (accumulator, path) => {
      Object.keys(swaggerDocs.paths[path]).forEach((method) => {
        const request = swaggerDocs.paths[path][method as RequestMethod];
        request.tags.forEach((tag) => {
          if (!accumulator[tag]) {
            accumulator[tag] = [];
          }
          accumulator[tag].push({
            ...request,
            method: method as RequestMethod,
          });
        });
      });
      return accumulator;
    },
    {} as Record<string, TypescriptAPIGeneratorRequest[]>
  );

  // Find all Schemas referenced in the requests
  const schemaEntityReferences = Object.values(requestGroupings).reduce(
    (accumulator, requests) => {
      requests.forEach(({ tags, responses }) => {
        Object.values(responses).forEach(({ content }) => {
          if ('application/json' in content) {
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

  // Generate Schema to entity mappings
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

  // Map schema references to entities
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
          } = generateSchemaCode({
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

  //#region Write model output files
  const modelsOutputFilePath = `${outputRootPath}/models`;
  ensureDirSync(modelsOutputFilePath);
  Object.keys(models).forEach((entityName) => {
    const pascalCaseEntityName = entityName.toPascalCase();
    const modelFileName = `${pascalCaseEntityName}.ts`;
    const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;

    const entityModelsOutputCode = Object.values(models[entityName].models)
      .sort(
        (
          { referencedSchemas: aReferencedSchemas, name: aName },
          { referencedSchemas: bReferencedSchemas, name: bName }
        ) => {
          if (aReferencedSchemas && !bReferencedSchemas) {
            return 1;
          }
          if (!aReferencedSchemas && bReferencedSchemas) {
            return -1;
          }
          if (aReferencedSchemas && bReferencedSchemas) {
            if (aReferencedSchemas.includes(bName)) {
              return 1;
            }
            if (bReferencedSchemas.includes(aName)) {
              return -1;
            }
          }
          return 0;
        }
      )
      .map((model) => model.zodValidationSchemaCode)
      .join('\n\n');

    writeFileSync(
      entityModelsOutputFilePath,
      prettier.format(
        [
          ...(() => {
            if (models[entityName].imports) {
              return Object.keys(models[entityName].imports!).map(
                (importFilePath) => {
                  const importNames =
                    models[entityName].imports![importFilePath];
                  return `import { ${importNames.join(
                    ', '
                  )} } from '${importFilePath}';`;
                }
              );
            }
            return [];
          })(),
          entityModelsOutputCode,
        ].join('\n\n'),
        {
          filepath: entityModelsOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  });
  //#endregion

  if (outputInternalState) {
    ensureDirSync(outputRootPath);
    writeFileSync(
      `${outputRootPath}/request-groupings.output.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-references.output.json`,
      JSON.stringify(schemaEntityReferences, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-to-entity-mappings.output.json`,
      JSON.stringify(schemaEntityMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-groupings.output.json`,
      JSON.stringify(entitySchemaGroups, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/validation-schemas.output.json`,
      JSON.stringify(models, null, 2)
    );
  }
};
