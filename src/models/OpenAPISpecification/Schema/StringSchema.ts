import { z } from 'zod';

export const StringSchemaValidationSchema = z.object({
  type: z.literal('string').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  format: z
    .enum(['date', 'date-time', 'email', 'uri'] as const)
    .optional()
    .describe('The schema property format.'),
  enum: z.array(z.string()).optional().describe('The schema property enum.'),
  minLength: z.number().optional().describe('The schema property min length.'),
  maxLength: z.number().optional().describe('The schema property max length.'),
  example: z.string().optional().describe('The schema property example.'),
  default: z.string().optional().describe('The schema property default.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
});

export type StringSchema = z.infer<typeof StringSchemaValidationSchema>;
