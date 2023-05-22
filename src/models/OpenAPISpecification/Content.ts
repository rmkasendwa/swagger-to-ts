import { z } from 'zod';

import {
  ArraySchemaPropertyValidationSchema,
  RefSchemaPropertyValidationSchema,
  SchemaValidationSchema,
} from './Schema';

//#region JSONContent
export const JSONContentValidationSchema = z.object({
  'application/json': z.object({
    schema: z.union([
      RefSchemaPropertyValidationSchema,
      SchemaValidationSchema,
      ArraySchemaPropertyValidationSchema,
    ]),
  }),
});

export type JSONContent = z.infer<typeof JSONContentValidationSchema>;
//#endregion

//#region PNGContent
export const PNGContentValidationSchema = z.object({
  'image/png': z.object({
    schema: z.union([
      RefSchemaPropertyValidationSchema,
      SchemaValidationSchema,
    ]),
  }),
});

export type PNGContent = z.infer<typeof PNGContentValidationSchema>;
//#endregion

//#region GenericContent
export const GenericContentValidationSchema = z.object({
  '*/*': z.object({
    schema: z.object({
      type: z.string(),
    }),
  }),
});

export type GenericContent = z.infer<typeof GenericContentValidationSchema>;
//#endregion

//#region Content
export const ContentValidationSchema: any = z.union([
  JSONContentValidationSchema,
  PNGContentValidationSchema,
  GenericContentValidationSchema,
]);

export type Content = JSONContent | PNGContent | GenericContent;
//#endregion
