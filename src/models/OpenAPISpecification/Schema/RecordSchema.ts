import { z } from 'zod';

import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { RefSchemaValidationSchema } from './RefSchema';
import { StringSchemaValidationSchema } from './StringSchema';

export const RecordSchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  additionalProperties: z.union([
    z.object({
      type: z.literal('array').describe('The schema property type.'),
      items: z
        .union([
          StringSchemaValidationSchema,
          NumberSchemaValidationSchema,
          BooleanSchemaValidationSchema,
          NullSchemaValidationSchema,
          RefSchemaValidationSchema,
        ])
        .optional()
        .describe('The schema property items.'),
    }),
    z
      .union([
        StringSchemaValidationSchema,
        NumberSchemaValidationSchema,
        BooleanSchemaValidationSchema,
        NullSchemaValidationSchema,
        RefSchemaValidationSchema,
      ])
      .optional()
      .describe('The schema property items.'),
  ]),
  properties: z.any().optional().describe('The schema property properties.'),
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
