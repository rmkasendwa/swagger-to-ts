import { z } from 'zod';

//#region StringSchemaProperty
export const StringSchemaPropertyValidationSchema = z.object({
  type: z.literal('string').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  format: z
    .enum(['date', 'date-time'])
    .optional()
    .describe('The schema property format.'),
  enum: z.array(z.string()).optional().describe('The schema property enum.'),
  minLength: z.number().optional().describe('The schema property min length.'),
  maxLength: z.number().optional().describe('The schema property max length.'),
  example: z.string().optional().describe('The schema property example.'),
  default: z.string().optional().describe('The schema property default.'),
});

export type StringSchemaProperty = z.infer<
  typeof StringSchemaPropertyValidationSchema
>;
//#endregion

//#region NumberSchemaProperty
export const NumberSchemaPropertyValidationSchema = z.object({
  type: z.literal('number').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.number().optional().describe('The schema property example.'),
  default: z.number().optional().describe('The schema property default.'),
  min: z.number().optional().describe('The schema property min.'),
  max: z.number().optional().describe('The schema property max.'),
});

export type NumberSchemaProperty = z.infer<
  typeof NumberSchemaPropertyValidationSchema
>;
//#endregion

//#region BooleanSchemaProperty
export const BooleanSchemaPropertyValidationSchema = z.object({
  type: z.literal('boolean').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.boolean().optional().describe('The schema property example.'),
  default: z.boolean().optional().describe('The schema property default.'),
});

export type BooleanSchemaProperty = z.infer<
  typeof BooleanSchemaPropertyValidationSchema
>;
//#endregion

//#region PrimitiveSchemaProperty
export const PrimitiveSchemaPropertyValidationSchema = z.union([
  StringSchemaPropertyValidationSchema,
  NumberSchemaPropertyValidationSchema,
  BooleanSchemaPropertyValidationSchema,
]);

export type PrimitiveSchemaProperty = z.infer<
  typeof PrimitiveSchemaPropertyValidationSchema
>;
//#endregion

//#region ArraySchemaProperty
export const ArraySchemaPropertyValidationSchema = z.object({
  type: z.literal('array').describe('The schema property type.'),
  items: PrimitiveSchemaPropertyValidationSchema.optional().describe(
    'The schema property items.'
  ),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.array(z.any()).optional().describe('The schema property example.'),
  default: z.array(z.any()).optional().describe('The schema property default.'),
});

export type ArraySchemaProperty = z.infer<
  typeof ArraySchemaPropertyValidationSchema
>;
//#endregion

//#region RefSchemaProperty
export const RefSchemaPropertyValidationSchema = z.object({
  $ref: z.string().describe('The schema property ref.'),
});

export type RefSchemaProperty = z.infer<
  typeof RefSchemaPropertyValidationSchema
>;
//#endregion

//#region SchemaProperty
export const SchemaPropertyValidationSchema = z.union([
  StringSchemaPropertyValidationSchema,
  NumberSchemaPropertyValidationSchema,
  BooleanSchemaPropertyValidationSchema,
  ArraySchemaPropertyValidationSchema,
  RefSchemaPropertyValidationSchema,
]);

export type SchemaProperty = z.infer<typeof SchemaPropertyValidationSchema>;
//#endregion

//#region Schema
export const SchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema type.'),
  properties: z
    .record(SchemaPropertyValidationSchema)
    .optional()
    .describe('The schema properties.'),
  required: z
    .array(z.string())
    .optional()
    .describe('The schema required properties.'),
});

export type Schema = z.infer<typeof SchemaValidationSchema>;
//#endregion
