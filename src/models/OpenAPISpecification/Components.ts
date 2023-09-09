import { z } from 'zod';

import { SchemaValidationSchema } from './Schema';

//#region SecurityScheme
export const ApikeyAuthValidationSchema = z.object({
  type: z.string().describe('The security scheme type.'),
  in: z.string().optional().describe('The security scheme location.'),
  name: z.string().optional().describe('The security scheme name.'),
});

export const BearerAuthValidationSchema = z.object({
  type: z.string().describe('The security scheme type.'),
  scheme: z
    .literal('bearer')
    .optional()
    .describe('The security scheme scheme.'),
  bearerFormat: z
    .string()
    .optional()
    .describe('The security scheme bearer format.'),
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
    .describe('An object to hold reusable Security Scheme Objects.'),
  schemas: z
    .record(SchemaValidationSchema)
    .describe('An object to hold reusable Schema Objects.'),
});

export type Components = z.infer<typeof ComponentsValidationSchema>;
//#endregion
