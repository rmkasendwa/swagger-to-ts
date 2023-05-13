import { OpenAPISpecification } from '../models';

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
