import { z } from 'zod';

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
