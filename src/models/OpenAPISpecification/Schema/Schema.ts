import { z } from 'zod';

import { ArraySchemaPropertyValidationSchema } from './ArraySchema';
import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchemaValidationSchema } from './ObjectSchema';
import { PrimitiveUnionSchemaValidationSchema } from './PrimitiveUnionSchema';
import { RecordSchemaValidationSchema } from './RecordSchema';
import { RefSchemaValidationSchema } from './RefSchema';
import { StringSchemaValidationSchema } from './StringSchema';

//#region SchemaProperty
export const SchemaPropertyValidationSchema = z.union([
  RecordSchemaValidationSchema,
  StringSchemaValidationSchema,
  NumberSchemaValidationSchema,
  BooleanSchemaValidationSchema,
  NullSchemaValidationSchema,
  PrimitiveUnionSchemaValidationSchema,
  ObjectSchemaValidationSchema,
  ArraySchemaPropertyValidationSchema,
  RefSchemaValidationSchema,
]);

export type SchemaProperty = z.infer<typeof SchemaPropertyValidationSchema>;
//#endregion

//#region UnionSchemaProperty
const UnionSchemaPropertyValidationSchema = z.object({
  oneOf: z
    .array(
      z.union([
        StringSchemaValidationSchema,
        NumberSchemaValidationSchema,
        BooleanSchemaValidationSchema,
        NullSchemaValidationSchema,
        PrimitiveUnionSchemaValidationSchema,
        ObjectSchemaValidationSchema,
        ArraySchemaPropertyValidationSchema,
        RefSchemaValidationSchema,
        RecordSchemaValidationSchema,
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
