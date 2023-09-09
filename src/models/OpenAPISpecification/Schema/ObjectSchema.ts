import { z } from 'zod';

import { RefSchemaValidationSchema } from './RefSchema';

export const ObjectSchemaMemberValidationSchema = z.union([
  z.array(
    z.union([
      z.object({
        type: z.literal('string').describe('The schema property type.'),
      }),
      RefSchemaValidationSchema,
    ])
  ),
  RefSchemaValidationSchema,
]);

export type ObjectSchemaMember = z.infer<
  typeof ObjectSchemaMemberValidationSchema
>;

export const ObjectSchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  properties: z
    .record(ObjectSchemaMemberValidationSchema)
    .optional()
    .describe('The schema property properties.'),
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

export type ObjectSchema = z.infer<typeof ObjectSchemaValidationSchema>;
