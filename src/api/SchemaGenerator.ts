import { OpenAPISpecification } from '../models';
import { RequestParameter } from '../models/OpenAPISpecification/Request';
import { Schema } from '../models/OpenAPISpecification/Schema';

//#region Find all schemas referenced by a schema
export interface FindSchemaReferencedSchemasOptions {
  /**
   * The OpenAPI specification to search for referenced schemas.
   */
  openAPISpecification: OpenAPISpecification;

  /**
   * The name of the schema to find all referenced schemas for.
   */
  schemaName: string;
}

/**
 * Find all schemas referenced by a schema.
 *
 * @param options The options to find all referenced schemas for a schema.
 * @returns All schemas referenced by the schema.
 */
export const findSchemaReferencedSchemas = ({
  schemaName,
  openAPISpecification,
}: FindSchemaReferencedSchemasOptions) => {
  const schemaReferencedSchemas: string[] = [];

  /**
   * Find all referenced schemas recursively.
   *
   * @param schemaName The name of the schema to find all referenced schemas for.
   */
  const findSchemaReferencedSchemasRecursive = (schemaName: string) => {
    const schema = openAPISpecification.components.schemas[schemaName];
    if (schema) {
      /**
       * Traverses a schema object looking for $ref properties.
       *
       * @param schema The schema to traverse.
       */
      const traverseSchemaObject = (schema: Schema) => {
        Object.keys(schema).forEach((schemaKey) => {
          if ('$ref' in schema && schemaKey === '$ref') {
            const schemaName = schema.$ref.replace('#/components/schemas/', '');
            if (!schemaReferencedSchemas.includes(schemaName)) {
              schemaReferencedSchemas.unshift(schemaName);
              findSchemaReferencedSchemasRecursive(schemaName);
            }
          }
          if (typeof (schema as any)[schemaKey] === 'object') {
            traverseSchemaObject((schema as any)[schemaKey]);
          }
        });
      };
      traverseSchemaObject(schema);
    }
  };
  findSchemaReferencedSchemasRecursive(schemaName);
  return schemaReferencedSchemas;
};
//#endregion

//#region Generate schema from request parameters
export interface GenerateSchemaFromRequestParametersOptions {
  /**
   * The request parameters to generate a schema from.
   */
  requestParameters: RequestParameter[];
}

/**
 * Generate a schema from request parameters.
 *
 * @param options The options to generate a schema from request parameters.
 * @returns The generated schema from the request parameters.
 */
export const generateSchemaFromRequestParameters = ({
  requestParameters,
}: GenerateSchemaFromRequestParametersOptions) => {
  return {
    type: 'object',
    properties: requestParameters
      .filter(({ schema }) => {
        if ('$ref' in schema && !schema.$ref.match(/^#\//g)) {
          return false;
        }
        if (
          'type' in schema &&
          schema.type === 'array' &&
          'items' in schema &&
          schema.items &&
          '$ref' in schema.items &&
          !schema.items.$ref.match(/^#\//g)
        ) {
          return false;
        }
        return true;
      })
      .reduce<Record<string, Schema>>(
        (accumulator, { name, schema, description }) => {
          accumulator[name] = {
            ...schema,
            description,
          };
          return accumulator;
        },
        {}
      ),
    required: requestParameters
      .filter(({ required }) => {
        return required;
      })
      .map(({ name }) => {
        return name;
      }),
  } as Schema;
};
//#endregion

//#region Get schema primitive schema type
export const getPrimitiveSchemaType = (schema: Schema) => {
  if ('type' in schema) {
    switch (schema.type) {
      case 'boolean':
        return 'boolean';
      case 'integer':
      case 'number':
        return 'number';
      case 'string':
        if (schema.enum) {
          return schema.enum
            .filter((value) => value.length > 0)
            .map((value) => `'${value}'`)
            .join(' | ');
        }
        return 'string';
    }
  }
  return 'any';
};
//#endregion
