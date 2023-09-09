import { z } from 'zod';

export const PrimitiveUnionSchemaPropertyValidationSchema = z.object({
  type: z
    .array(z.enum(['string', 'number', 'boolean', 'null'] as const))
    .describe('The schema property type.'),
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

export type PrimitiveUnionSchemaProperty = z.infer<
  typeof PrimitiveUnionSchemaPropertyValidationSchema
>;
