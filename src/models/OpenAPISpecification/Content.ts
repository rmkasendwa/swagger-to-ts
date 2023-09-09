import { z } from 'zod';

import { SchemaValidationSchema } from './Schema';

//#region JSONContent
export const JSONContentValidationSchema = z.object({
  'application/json': z.object({
    schema: SchemaValidationSchema.optional(),
  }),
});

export type JSONContent = z.infer<typeof JSONContentValidationSchema>;
//#endregion

//#region PDFContent
export const PDFContentValidationSchema = z.object({
  'application/pdf': z.object({
    schema: z.any().optional(),
  }),
});

export type PDFContent = z.infer<typeof PDFContentValidationSchema>;
//#endregion

//#region PNGContent
export const PNGContentValidationSchema = z.object({
  'image/png': z.object({
    schema: z.any().optional(),
  }),
});

export type PNGContent = z.infer<typeof PNGContentValidationSchema>;
//#endregion

//#region GenericContent
export const GenericContentValidationSchema = z.object({
  '*/*': z.object({
    schema: z.any().optional(),
  }),
});

export type GenericContent = z.infer<typeof GenericContentValidationSchema>;
//#endregion

//#region Content
export const ContentValidationSchema: any = z.union([
  JSONContentValidationSchema,
  PNGContentValidationSchema,
  PDFContentValidationSchema,
  GenericContentValidationSchema,
  z.record(z.any()),
]);

export type Content = JSONContent | PNGContent | GenericContent;
//#endregion
