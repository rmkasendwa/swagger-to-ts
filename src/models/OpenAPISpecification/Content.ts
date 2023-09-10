import { z } from 'zod';

import { Schema, SchemaValidationSchema } from './Schema';

//#region JSONContent
export const JSONContentValidationSchema = z.object({
  'application/json': z.object({
    schema: SchemaValidationSchema.optional(),
  }),
});

export type JSONContent = {
  'application/json'?: {
    schema?: Schema;
  };
};
//#endregion

//#region PDFContent
export const PDFContentValidationSchema = z.object({
  'application/pdf': z.object({
    schema: z.any().optional(),
  }),
});

export type PDFContent = {
  'image/png'?: {
    schema?: any;
  };
};
//#endregion

//#region PNGContent
export const PNGContentValidationSchema = z.object({
  'image/png': z.object({
    schema: z.any().optional(),
  }),
});

export type PNGContent = {
  'image/png'?: {
    schema?: any;
  };
};
//#endregion

//#region GenericContent
export const GenericContentValidationSchema = z.object({
  '*/*': z.object({
    schema: z.any().optional(),
  }),
});

export type GenericContent = {
  '*/*'?: {
    schema?: any;
  };
};
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
