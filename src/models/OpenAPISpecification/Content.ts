import { z } from 'zod';

import { Schema, SchemaValidationSchema, StringSchema } from './Schema';

//#region JSONContent
export const JSONContentValidationSchema = z.object({
  'application/json': z.object({
    schema: SchemaValidationSchema.optional(),
  }),
});

export type JSONContent = {
  'application/json': {
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
  'application/pdf': {
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
  'image/png': {
    schema?: any;
  };
};
//#endregion

//#region XMLContent
export const XMLContentValidationSchema = z.object({
  'application/xml': z.object({
    schema: z.any(),
  }),
});

export type XMLContent = {
  'application/xml': {
    schema: StringSchema;
  };
};
//#endregion

//#region HTMLContent
export const HTMLContentValidationSchema = z.object({
  'text/html': z.object({
    schema: z.any(),
  }),
});

export type HTMLContent = {
  'text/html': {
    schema: StringSchema;
  };
};
//#endregion

//#region CSVContent
export const CSVContentValidationSchema = z.object({
  'text/csv': z.object({
    schema: z.any(),
  }),
});

export type CSVContent = {
  'text/csv': {
    schema: StringSchema;
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
  '*/*': {
    schema?: any;
  };
};
//#endregion

//#region Content
export const ContentValidationSchema: any = z.any();

export type Content = Partial<
  JSONContent &
    PNGContent &
    PDFContent &
    XMLContent &
    HTMLContent &
    CSVContent &
    GenericContent
>;
//#endregion
