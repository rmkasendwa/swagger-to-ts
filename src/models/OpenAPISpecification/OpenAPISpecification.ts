import { z } from 'zod';

import { RequestValidationSchema } from './Request';
import { SchemaValidationSchema } from './Schema';

//#region OpenAPISpecificationInfo
export const InfoValidationSchema = z.object({
  version: z.string().describe('The open api version.'),
  title: z.string().describe('The open api title.'),
  description: z.string().optional().describe('The open api description.'),
});

export type Info = z.infer<typeof InfoValidationSchema>;
//#endregion

//#region SecurityScheme
export const ApikeyAuthValidationSchema = z.object({
  type: z.string().describe('The security scheme type.'),
  in: z.string().describe('The security scheme location.'),
  name: z.string().describe('The security scheme name.'),
});

export const BearerAuthValidationSchema = z.object({
  type: z.string().describe('The security scheme type.'),
  scheme: z.literal('bearer').describe('The security scheme scheme.'),
  bearerFormat: z.string().describe('The security scheme bearer format.'),
});

export const SecuritySchemeValidationSchema = z
  .union([ApikeyAuthValidationSchema, BearerAuthValidationSchema])
  .describe('The open api security scheme.');

export type SecurityScheme = z.infer<typeof SecuritySchemeValidationSchema>;
//#endregion

//#region Components
export const ComponentsValidationSchema = z.object({
  securitySchemes: z
    .record(SecuritySchemeValidationSchema)
    .describe('The open api security schemes.'),
  schemas: z.record(SchemaValidationSchema).describe('The open api schemas.'),
});

export type Components = z.infer<typeof ComponentsValidationSchema>;
//#endregion

//#region SecurityScheme
export const SecurityValidationSchema = z.union([
  z.object({
    APIKeyAuth: z.array(z.any()).describe('The API key authentication.'),
  }),
  z.object({
    BearerAuth: z.array(z.any()).describe('The API key authentication.'),
  }),
]);

export type Security = z.infer<typeof SecurityValidationSchema>;
//#endregion

//#region Tag
export const TagValidationSchema = z.object({
  name: z.string().describe('The tag name.'),
});

export type Tag = z.infer<typeof TagValidationSchema>;
//#endregion

export const OpenAPISpecificationValidationSchema = z.object({
  openapi: z.string().describe('The open api version.'),
  info: InfoValidationSchema.describe('The open api information.'),
  components: ComponentsValidationSchema.describe('The open api components.'),
  security: z
    .array(SecurityValidationSchema)
    .optional()
    .describe('The server security configuration.'),
  paths: z
    .record(z.record(RequestValidationSchema))
    .describe('The server request paths.'),
  tags: z.array(TagValidationSchema).describe('The server endpoint groups.'),
});

export type OpenAPISpecification = z.infer<
  typeof OpenAPISpecificationValidationSchema
>;
