import { z } from 'zod';

export const NullSchemaValidationSchema = z.object({
  type: z.literal('null').describe('The schema property type.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.null().optional().describe('The schema property example.'),
  default: z.null().optional().describe('The schema property default.'),
});

export type NullSchema = {
  type: 'null';
  description?: string;
  example?: null;
  default?: null;
};
