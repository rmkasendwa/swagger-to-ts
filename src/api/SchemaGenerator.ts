import { OpenAPISpecification } from '../models';
import { RequestParameter } from '../models/OpenAPISpecification/Request';
import { Schema, SchemaProperty } from '../models/OpenAPISpecification/Schema';

//#region Find all schemas referenced by a schema
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
    if (schema.type === 'object' && schema.properties) {
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
//#endregion

export interface GenerateSchemaFromRequestParametersOptions {
  requestParameters: RequestParameter[];
}
export const generateSchemaFromRequestParameters = ({
  requestParameters,
}: GenerateSchemaFromRequestParametersOptions) => {
  return {
    type: 'object',
    properties: requestParameters.reduce((accumulator, { name, schema }) => {
      accumulator[name] = schema;
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
