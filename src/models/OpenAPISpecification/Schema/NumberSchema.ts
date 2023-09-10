import { z } from 'zod';

export const NumberSchemaValidationSchema = z.object({
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

export type NumberSchema = {
  type: 'number' | 'integer';
  description?: string;
  example?: number;
  default?: number;
  min?: number;
  max?: number;
  nullable?: boolean;
};
