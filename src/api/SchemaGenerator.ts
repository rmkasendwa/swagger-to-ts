import { OpenAPISpecification } from '../models';
import { RequestParameter } from '../models/OpenAPISpecification/Request';
import { Schema, SchemaProperty } from '../models/OpenAPISpecification/Schema';

//#region Find all schemas referenced by a schema
export interface FindSchemaReferencedSchemasOptions {
  openAPISpecification: OpenAPISpecification;
  schemaName: string;
}
export const findSchemaReferencedSchemas = ({
  schemaName,
  openAPISpecification,
}: FindSchemaReferencedSchemasOptions) => {
  const schemaReferencedSchemas: string[] = [];
  const findSchemaReferencedSchemasRecursive = (schemaName: string) => {
    const schema = openAPISpecification.components.schemas[schemaName];
    if (schema && schema.type === 'object' && schema.properties) {
      Object.values(schema.properties).forEach((property) => {
        if ('type' in property) {
          switch (property.type) {
            case 'array':
              if (property.items && '$ref' in property.items) {
                const schemaName = property.items.$ref.split('/').pop()!;
                if (!schemaReferencedSchemas.includes(schemaName)) {
                  schemaReferencedSchemas.unshift(schemaName);
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
//#endregion

//#region Generate schema from request parameters
export interface GenerateSchemaFromRequestParametersOptions {
  requestParameters: RequestParameter[];
}
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
          schema.items &&
          '$ref' in schema.items &&
          !schema.items.$ref.match(/^#\//g)
        ) {
          return false;
        }
        return true;
      })
      .reduce((accumulator, { name, schema, description }) => {
        accumulator[name] = {
          ...schema,
          description,
        };
        return accumulator;
      }, {} as Record<string, SchemaProperty>),
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
