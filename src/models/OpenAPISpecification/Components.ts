import { z } from 'zod';

import { Schema, SchemaValidationSchema } from './Schema';

//#region SecurityScheme
export const ApikeyAuthValidationSchema = z.object({
  type: z.string().describe('The security scheme type.'),
  in: z.string().optional().describe('The security scheme location.'),
  name: z.string().optional().describe('The security scheme name.'),
});

export type ApikeyAuth = {
  type: string;
  in?: string;
  name?: string;
};

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

export type BearerAuth = {
  type: string;
  scheme?: 'bearer';
  bearerFormat?: string;
};

export const SecuritySchemeValidationSchema = z
  .union([ApikeyAuthValidationSchema, BearerAuthValidationSchema])
  .describe('The open api security scheme.');

export type SecurityScheme = ApikeyAuth | BearerAuth;
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

export type Components = {
  securitySchemes: Record<string, SecurityScheme>;
  schemas: Record<string, Schema>;
};
//#endregion
