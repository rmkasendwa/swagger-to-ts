import { z } from 'zod';

import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchemaValidationSchema } from './ObjectSchema';
import { RefSchemaValidationSchema } from './RefSchema';
import { StringSchemaValidationSchema } from './StringSchema';

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

export type RecordSchema = z.infer<typeof RecordSchemaValidationSchema>;
