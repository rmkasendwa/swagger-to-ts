import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';

import { OpenAPISpecification } from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import {
  SchemaCode,
  TypescriptAPIGeneratorRequest,
} from '../models/TypescriptAPIGenerator';
import { findSchemaReferencedSchemas } from './FindSchemaReferencedSchemas';
import { generateSchemaCode } from './GenerateSchemaCode';

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

  // Generate validation schemas code
  const validationSchemas = Object.keys(entitySchemaGroups)
    .sort()
    .reduce((accumulator, entityName) => {
      entitySchemaGroups[entityName].sort().forEach((schemaName) => {
        if (!accumulator[entityName]) {
          accumulator[entityName] = {};
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

        accumulator[entityName][schemaName] = {
          zodValidationSchemaCode,
          zodValidationSchemaConfiguration,
          zodValidationSchemaName,
          inferedTypeCode,
          referencedSchemas,
          generatedVariables,
          imports,
        };
      });
      return accumulator;
    }, {} as Record<string, Record<string, SchemaCode>>);

  // Write model output files
  // const modelsOutputPath = `${outputRootPath}/models`;

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
      JSON.stringify(validationSchemas, null, 2)
    );
  }
};
