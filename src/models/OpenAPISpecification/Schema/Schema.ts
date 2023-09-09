import { z } from 'zod';

import { ArraySchemaPropertyValidationSchema } from './ArraySchema';
import { BooleanSchemaPropertyValidationSchema } from './BooleanSchema';
import { NullSchemaPropertyValidationSchema } from './NullSchema';
import { NumberSchemaPropertyValidationSchema } from './NumberSchema';
import { ObjectSchemaPropertyValidationSchema } from './ObjectSchema';
import { PrimitiveUnionSchemaPropertyValidationSchema } from './PrimitiveUnionSchema';
import { RecordSchemaPropertyValidationSchema } from './RecordSchema';
import { RefSchemaPropertyValidationSchema } from './RefSchema';
import { StringSchemaPropertyValidationSchema } from './StringSchema';

//#region SchemaProperty
export const SchemaPropertyValidationSchema = z.union([
  RecordSchemaPropertyValidationSchema,
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
        RecordSchemaPropertyValidationSchema,
      ])
    )
    .describe('The schema property one of.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
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
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
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
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
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
