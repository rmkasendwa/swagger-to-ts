import { z } from 'zod';

import { BooleanSchemaPropertyValidationSchema } from './BooleanSchema';
import { NullSchemaPropertyValidationSchema } from './NullSchema';
import { NumberSchemaPropertyValidationSchema } from './NumberSchema';
import { RefSchemaPropertyValidationSchema } from './RefSchema';
import { StringSchemaPropertyValidationSchema } from './StringSchema';

export const RecordSchemaPropertyValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  additionalProperties: z.union([
    z.object({
      type: z.literal('array').describe('The schema property type.'),
      items: z
        .union([
          StringSchemaPropertyValidationSchema,
          NumberSchemaPropertyValidationSchema,
          BooleanSchemaPropertyValidationSchema,
          NullSchemaPropertyValidationSchema,
          RefSchemaPropertyValidationSchema,
        ])
        .optional()
        .describe('The schema property items.'),
    }),
    z
      .union([
        StringSchemaPropertyValidationSchema,
        NumberSchemaPropertyValidationSchema,
        BooleanSchemaPropertyValidationSchema,
        NullSchemaPropertyValidationSchema,
        RefSchemaPropertyValidationSchema,
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

export type RecordSchemaProperty = z.infer<
  typeof RecordSchemaPropertyValidationSchema
>;
