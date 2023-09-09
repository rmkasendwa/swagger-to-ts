import { z } from 'zod';

import { RefSchemaPropertyValidationSchema } from './RefSchema';

export const ObjectSchemaPropertyMemberValidationSchema = z.union([
  z.array(
    z.union([
      z.object({
        type: z.literal('string').describe('The schema property type.'),
      }),
      RefSchemaPropertyValidationSchema,
    ])
  ),
  RefSchemaPropertyValidationSchema,
]);

export type ObjectSchemaPropertyMember = z.infer<
  typeof ObjectSchemaPropertyMemberValidationSchema
>;

export const ObjectSchemaPropertyValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  properties: z
    .record(ObjectSchemaPropertyMemberValidationSchema)
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

export type ObjectSchemaProperty = z.infer<
  typeof ObjectSchemaPropertyValidationSchema
>;
