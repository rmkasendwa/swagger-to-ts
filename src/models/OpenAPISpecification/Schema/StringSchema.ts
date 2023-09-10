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

export type StringSchema = {
  /**
   * The schema property type.
   */
  type: 'string';

  /**
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property format.
   */
  format?: 'date' | 'date-time' | 'email' | 'uri';

  /**
   * The schema property enum.
   */
  enum?: string[];

  /**
   * The schema property min length.
   */
  minLength?: number;

  /**
   * The schema property max length.
   */
  maxLength?: number;

  /**
   * The schema property example.
   */
  example?: string;

  /**
   * The schema property default.
   */
  default?: string;

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};
