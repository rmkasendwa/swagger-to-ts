import { z } from 'zod';

export const BooleanSchemaValidationSchema = z.object({
  type: z.literal('boolean').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.boolean().optional().describe('The schema property example.'),
  default: z.boolean().optional().describe('The schema property default.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
});

export type BooleanSchema = z.infer<typeof BooleanSchemaValidationSchema>;
