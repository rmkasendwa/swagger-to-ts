import '@infinite-debugger/rmk-js-extensions/String';

import { writeFileSync } from 'fs-extra';
import prettier from 'prettier';

import { OpenAPISpecification } from '../models';
import { Request, RequestMethod } from '../models/OpenAPISpecification/Request';

type Parameter = {
  name: string;
  description?: string;
  required?: boolean;
  type: string;
  schema: any;
};

interface APIAction {
  name: string;
  endpointPathIdentifierString: string;
  enpointPathString: string;
  snippet: string;
}

interface APIEntity {
  entityNamePascalCase: string;
  entityNameUpperCase: string;
  entityNameCamelCase: string;
  apiModuleImports: Record<string, string[]>;
  actions: APIAction[];
  endpointPaths: Record<string, string>;
  interfaceSnippets: Record<string, string>;
}

const prettierConfig: prettier.Options = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  endOfLine: 'auto',
};

const ouputSubFolders = [
  'api',
  'data-keys',
  'endpoint-paths',
  'models',
] as const;

const PATHS_LIB = `@infinite-debugger/rmk-utils/paths`;
const API_ADAPTER_PATH = `./Adapter`;
const modelsFileLocationRelativetoAPI = `../models`;

export const TYPESCRIPT_ENVIRONMENT_INTERFACES = ['ArrayBuffer'];
export const BINARY_RESPONSE_TYPES = ['ArrayBuffer'];

export interface ExtendedRequest extends Request {
  method: RequestMethod;
}

export interface ZodValidationSchemaProperty {
  code: string;
}

export interface SchemaCode {
  zodValidationSchemaName: string;
  zodValidationSchemaCode: Record<string, ZodValidationSchemaProperty>;
  inferedTypeCode: string;
  imports?: Record<string, string[]>;
  referencedSchemas?: string[];
}

export interface GenerateTypescriptAPIConfig {
  swaggerDocs: OpenAPISpecification;
  outputRootPath: string;
}

export const generateTypescriptAPI = async ({
  swaggerDocs,
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
    {} as Record<string, ExtendedRequest[]>
  );

  // Find all Schemas referenced in the requests
  const schemaReferences = Object.values(requestGroupings).reduce(
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

  // Map schema references to entities
  const schemaGroups = Object.keys(schemaReferences).reduce(
    (accumulator, schemaName) => {
      if (schemaReferences[schemaName].length === 1) {
        schemaReferences[schemaName].forEach((entityName) => {
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
  const validationSchemas = Object.keys(schemaGroups)
    .sort()
    .reduce((accumulator, entityName) => {
      schemaGroups[entityName].sort().forEach((schemaName) => {
        if (!accumulator[entityName]) {
          accumulator[entityName] = {};
        }
        const { code, referencedSchemas } = generateZodValidationSchemaCode({
          schemaName,
          swaggerDocs,
        });
        const zodValidationSchemaName = `${schemaName}ValidationSchema`;
        const inferedTypeCode = `z.infer<typeof ${zodValidationSchemaName}>`;
        const imports: Record<string, string[]> = {
          zod: ['z'],
        };
        accumulator[entityName][schemaName] = {
          zodValidationSchemaCode: code,
          zodValidationSchemaName,
          inferedTypeCode,
          referencedSchemas,
          imports,
        };
      });
      return accumulator;
    }, {} as Record<string, Record<string, SchemaCode>>);

  writeFileSync(
    `${__dirname}/request-groupings.output.json`,
    JSON.stringify(requestGroupings, null, 2)
  );

  writeFileSync(
    `${__dirname}/schema-references.output.json`,
    JSON.stringify(schemaReferences, null, 2)
  );

  writeFileSync(
    `${__dirname}/schema-groupings.output.json`,
    JSON.stringify(schemaGroups, null, 2)
  );

  writeFileSync(
    `${__dirname}/validation-schemas.output.json`,
    JSON.stringify(validationSchemas, null, 2)
  );
};

export interface FindSchemaReferencedSchemasOptions {
  swaggerDocs: OpenAPISpecification;
  schemaName: string;
}
export const findSchemaReferencedSchemas = ({
  schemaName,
  swaggerDocs,
}: FindSchemaReferencedSchemasOptions) => {
  const schemaReferencedSchemas: string[] = [];
  const findSchemaReferencedSchemasRecursive = (schemaName: string) => {
    const schema = swaggerDocs.components.schemas[schemaName];
    if (schema.type === 'object') {
      Object.values(schema.properties).forEach((property) => {
        if ('type' in property) {
          switch (property.type) {
            case 'array':
              if ('$ref' in property.items) {
                const schemaName = property.items.$ref.split('/').pop()!;
                if (!schemaReferencedSchemas.includes(schemaName)) {
                  schemaReferencedSchemas.push(schemaName);
                }
                findSchemaReferencedSchemasRecursive(schemaName);
              }
              break;
          }
        }
      });
    }
  };
  findSchemaReferencedSchemasRecursive(schemaName);
  return schemaReferencedSchemas;
};

export interface GenerateZodValidationSchemaCodeOptions {
  swaggerDocs: OpenAPISpecification;
  schemaName: string;
}
export const generateZodValidationSchemaCode = ({
  schemaName,
  swaggerDocs,
}: GenerateZodValidationSchemaCodeOptions) => {
  const schema = swaggerDocs.components.schemas[schemaName];
  const referencedSchemas: string[] = [];
  return {
    code: Object.keys(schema.properties).reduce((accumulator, propertyName) => {
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
                const enumValuesName = `${schemaName.toCamelCase()}${propertyName.toPascalCase()}Options`;
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
    }, {} as Record<string, ZodValidationSchemaProperty>),
    referencedSchemas,
  };
};
