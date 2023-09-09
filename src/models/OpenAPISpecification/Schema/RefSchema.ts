import { z } from 'zod';

export const RefSchemaPropertyValidationSchema = z.object({
  $ref: z.string().describe('The schema property ref.'),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
});

export type RefSchemaProperty = z.infer<
  typeof RefSchemaPropertyValidationSchema
>;
