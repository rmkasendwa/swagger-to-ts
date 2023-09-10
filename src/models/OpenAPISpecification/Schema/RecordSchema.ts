import { z } from 'zod';

import { BooleanSchema, BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchema, NullSchemaValidationSchema } from './NullSchema';
import { NumberSchema, NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchema, ObjectSchemaValidationSchema } from './ObjectSchema';
import { RefSchema, RefSchemaValidationSchema } from './RefSchema';
import { StringSchema, StringSchemaValidationSchema } from './StringSchema';

export const RecordSchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  additionalProperties: z.union([
    StringSchemaValidationSchema,
    NumberSchemaValidationSchema,
    BooleanSchemaValidationSchema,
    NullSchemaValidationSchema,
    ObjectSchemaValidationSchema,
    RefSchemaValidationSchema,
  ]),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.any().optional().describe('The schema property example.'),
  default: z.any().optional().describe('The schema property default.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
});

export type RecordSchema = {
  type: 'object';
  additionalProperties:
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | ObjectSchema
    | RefSchema;
  description?: string;
  example?: any;
  default?: any;
  nullable?: boolean;
};
