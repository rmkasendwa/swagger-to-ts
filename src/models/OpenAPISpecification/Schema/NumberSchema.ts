import { z } from 'zod';

export const NumberSchemaPropertyValidationSchema = z.object({
  type: z
    .enum(['number', 'integer'] as const)
    .describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.number().optional().describe('The schema property example.'),
  default: z.number().optional().describe('The schema property default.'),
  min: z.number().optional().describe('The schema property min.'),
  max: z.number().optional().describe('The schema property max.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
});

export type NumberSchemaProperty = z.infer<
  typeof NumberSchemaPropertyValidationSchema
>;
