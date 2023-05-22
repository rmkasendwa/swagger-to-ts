import { z } from 'zod';

//#region StringSchemaProperty
export const StringSchemaPropertyValidationSchema = z.object({
  type: z.literal('string').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  format: z
    .enum(['date', 'date-time', 'email', 'uri'] as const)
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
  type: z
    .enum(['number', 'integer'] as const)
    .describe('The schema property type.'),
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

//#region NullSchemaProperty
export const NullSchemaPropertyValidationSchema = z.object({
  type: z.literal('null').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.null().optional().describe('The schema property example.'),
  default: z.null().optional().describe('The schema property default.'),
});

export type NullSchemaProperty = z.infer<
  typeof NullSchemaPropertyValidationSchema
>;
//#endregion

//#region PrimitiveUnionSchemaProperty
export const PrimitiveUnionSchemaPropertyValidationSchema = z.object({
  type: z
    .array(z.enum(['string', 'number', 'boolean', 'null'] as const))
    .describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.any().optional().describe('The schema property example.'),
  default: z.any().optional().describe('The schema property default.'),
});

export type PrimitiveUnionSchemaProperty = z.infer<
  typeof PrimitiveUnionSchemaPropertyValidationSchema
>;
//#endregion

//#region RefSchemaProperty
export const RefSchemaPropertyValidationSchema = z.object({
  $ref: z.string().describe('The schema property ref.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
});

export type RefSchemaProperty = z.infer<
  typeof RefSchemaPropertyValidationSchema
>;
//#endregion

//#region ObjectSchemaProperty
export const ObjectSchemaPropertyValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  properties: z
    .record(
      z.union([
        z.array(
          z.object({
            type: z.literal('string').describe('The schema property type.'),
          })
        ),
        RefSchemaPropertyValidationSchema,
      ])
    )
    .optional()
    .describe('The schema property properties.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.any().optional().describe('The schema property example.'),
  default: z.any().optional().describe('The schema property default.'),
});

export type ObjectSchemaProperty = z.infer<
  typeof ObjectSchemaPropertyValidationSchema
>;
//#endregion

//#region PrimitiveSchemaProperty
export const ArraySchemaPropertyMemberValidationSchema = z.union([
  StringSchemaPropertyValidationSchema,
  NumberSchemaPropertyValidationSchema,
  BooleanSchemaPropertyValidationSchema,
  NullSchemaPropertyValidationSchema,
  RefSchemaPropertyValidationSchema,
]);

export type ArraySchemaPropertyMember = z.infer<
  typeof ArraySchemaPropertyMemberValidationSchema
>;
//#endregion

//#region ArraySchemaProperty
export const ArraySchemaPropertyValidationSchema = z.object({
  type: z.literal('array').describe('The schema property type.'),
  items: ArraySchemaPropertyMemberValidationSchema.optional().describe(
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

//#region SchemaProperty
export const SchemaPropertyValidationSchema = z.union([
  StringSchemaPropertyValidationSchema,
  NumberSchemaPropertyValidationSchema,
  BooleanSchemaPropertyValidationSchema,
  NullSchemaPropertyValidationSchema,
  PrimitiveUnionSchemaPropertyValidationSchema,
  ObjectSchemaPropertyValidationSchema,
  ArraySchemaPropertyValidationSchema,
  RefSchemaPropertyValidationSchema,
]);

export type SchemaProperty = z.infer<typeof SchemaPropertyValidationSchema>;
//#endregion

//#region UnionSchemaProperty
const UnionSchemaPropertyValidationSchema = z.object({
  oneOf: z
    .array(
      z.union([
        StringSchemaPropertyValidationSchema,
        NumberSchemaPropertyValidationSchema,
        BooleanSchemaPropertyValidationSchema,
        NullSchemaPropertyValidationSchema,
        PrimitiveUnionSchemaPropertyValidationSchema,
        ObjectSchemaPropertyValidationSchema,
        ArraySchemaPropertyValidationSchema,
        RefSchemaPropertyValidationSchema,
      ])
    )
    .describe('The schema property one of.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
});

export type UnionSchemaProperty = z.infer<
  typeof UnionSchemaPropertyValidationSchema
>;
//#endregion

//#region Object Schema
export const ObjectSchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema type.'),
  properties: z
    .record(
      z
        .union([
          SchemaPropertyValidationSchema,
          UnionSchemaPropertyValidationSchema,
        ])
        .optional()
        .describe('The schema properties.')
    )
    .optional(),
  required: z
    .array(z.string())
    .optional()
    .describe('The schema required properties.'),
});

export type ObjectSchema = z.infer<typeof ObjectSchemaValidationSchema>;
//#endregion

//#region Array Schema
export const ArraySchemaValidationSchema = z.object({
  type: z.literal('array').describe('The schema type.'),
  items: z.union([
    SchemaPropertyValidationSchema,
    UnionSchemaPropertyValidationSchema,
  ]),
});

export type ArraySchema = z.infer<typeof ArraySchemaValidationSchema>;
//#endregion

//#region Schema
export const SchemaValidationSchema = z.union([
  ObjectSchemaValidationSchema,
  ArraySchemaValidationSchema,
]);

export type Schema = z.infer<typeof SchemaValidationSchema>;
//#endregion
