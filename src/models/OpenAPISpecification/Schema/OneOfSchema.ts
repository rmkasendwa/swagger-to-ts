import { z } from 'zod';

import { ArraySchema, ArraySchemaValidationSchema } from './ArraySchema';
import { BooleanSchema, BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchema, NullSchemaValidationSchema } from './NullSchema';
import { NumberSchema, NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchema, ObjectSchemaValidationSchema } from './ObjectSchema';
import { RecordSchema, RecordSchemaValidationSchema } from './RecordSchema';
import { RefSchema, RefSchemaValidationSchema } from './RefSchema';
import { StringSchema, StringSchemaValidationSchema } from './StringSchema';

/**
 * Discriminator Object
 *
 * When request bodies or response payloads may be one of a number of different schemas,
 * a discriminator object can be used to aid in serialization, deserialization, and validation.
 * The discriminator is a specific object in a schema which is used to inform the consumer of
 * the document of an alternative schema based on the value associated with it.
 *
 * When using the discriminator, inline schemas will not be considered.
 */

export const OneOfSchemaValidationSchema = z.object({
  oneOf: z
    .array(
      z.union([
        StringSchemaValidationSchema,
        NumberSchemaValidationSchema,
        BooleanSchemaValidationSchema,
        NullSchemaValidationSchema,
        RecordSchemaValidationSchema,
        ObjectSchemaValidationSchema,
        ArraySchemaValidationSchema,
        RefSchemaValidationSchema,
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

export type OneOfSchema = {
  oneOf: (
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RecordSchema
    | ObjectSchema
    | ArraySchema
    | RefSchema
  )[];
  description?: string;
  nullable?: boolean;
};
