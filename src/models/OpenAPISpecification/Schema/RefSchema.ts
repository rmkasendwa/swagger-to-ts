import { z } from 'zod';

export const RefSchemaValidationSchema = z.object({
  $ref: z.string().describe('The schema property ref.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
});

export type RefSchema = z.infer<typeof RefSchemaValidationSchema>;
