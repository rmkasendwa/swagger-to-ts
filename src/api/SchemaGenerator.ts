import { OpenAPISpecification } from '../models';
import { RequestParameter } from '../models/OpenAPISpecification/Request';
import { Schema } from '../models/OpenAPISpecification/Schema';

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
  const findSchemaReferencedBySchemaProperty = (property: Schema) => {
    if ('type' in property) {
      switch (property.type) {
        case 'array':
          {
            if (property.items && '$ref' in property.items) {
              const schemaName = property.items.$ref.replace(
                '#/components/schemas/',
                ''
              );
              if (!schemaReferencedSchemas.includes(schemaName)) {
                schemaReferencedSchemas.unshift(schemaName);
                findSchemaReferencedSchemasRecursive(schemaName);
              }
            }
          }
          break;
        case 'object':
          {
            if (property.properties) {
              Object.values(property.properties).forEach((property) => {
                if (
                  typeof property === 'object' &&
                  property &&
                  '$ref' in property &&
                  typeof property.$ref === 'string'
                ) {
                  const schemaName = property.$ref.replace(
                    '#/components/schemas/',
                    ''
                  );
                  if (!schemaReferencedSchemas.includes(schemaName)) {
                    schemaReferencedSchemas.unshift(schemaName);
                    findSchemaReferencedSchemasRecursive(schemaName);
                  }
                }
              });
            }
          }
          break;
      }
    }
    if ('$ref' in property) {
      const schemaName = property.$ref.replace('#/components/schemas/', '');
      if (!schemaReferencedSchemas.includes(schemaName)) {
        schemaReferencedSchemas.unshift(schemaName);
        findSchemaReferencedSchemasRecursive(schemaName);
      }
    }
  };

  const findSchemaReferencedSchemasRecursive = (schemaName: string) => {
    const schema = openAPISpecification.components.schemas[schemaName];
    if (schema) {
      if (
        schema.type === 'object' &&
        'properties' in schema &&
        schema.properties
      ) {
        Object.values(schema.properties).forEach((property) => {
          if (property) {
            if ('oneOf' in property) {
              property.oneOf.forEach((property) => {
                if (property) {
                  findSchemaReferencedBySchemaProperty(property);
                }
              });
            } else {
              findSchemaReferencedBySchemaProperty(property);
            }
          }
        });
      } else if (schema.type === 'array' && schema.items) {
        if ('oneOf' in schema.items) {
          schema.items.oneOf.forEach((property) => {
            if (property) {
              findSchemaReferencedBySchemaProperty(property);
            }
          });
        } else {
          findSchemaReferencedBySchemaProperty(schema.items);
        }
      }
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
          'items' in schema &&
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
      }, {} as Record<string, Schema>),
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
