import { z } from 'zod';

import { BooleanSchemaPropertyValidationSchema } from './BooleanSchema';
import { NullSchemaPropertyValidationSchema } from './NullSchema';
import { NumberSchemaPropertyValidationSchema } from './NumberSchema';
import { RefSchemaPropertyValidationSchema } from './RefSchema';
import { StringSchemaPropertyValidationSchema } from './StringSchema';

//#region PrimitiveSchemaProperty
export const ArraySchemaPropertyMemberValidationSchema = z.union([
  StringSchemaPropertyValidationSchema,
  NumberSchemaPropertyValidationSchema,
  BooleanSchemaPropertyValidationSchema,
  NullSchemaPropertyValidationSchema,
  RefSchemaPropertyValidationSchema,
]);

export type ArraySchemaPropertyMember = z.infer<
  typeof ArraySchemaPropertyMemberValidationSchema
>;
//#endregion

//#region ArraySchemaProperty
export const ArraySchemaPropertyValidationSchema = z.object({
  type: z.literal('array').describe('The schema property type.'),
  items: ArraySchemaPropertyMemberValidationSchema.optional().describe(
    'The schema property items.'
  ),
  description: z
    .string()
    .optional()
    .describe('The schema property description.'),
  example: z.array(z.any()).optional().describe('The schema property example.'),
  default: z.array(z.any()).optional().describe('The schema property default.'),
  nullable: z
    .boolean()
    .optional()
    .describe('Whether the schema property is nullable or not.'),
});

export type ArraySchemaProperty = z.infer<
  typeof ArraySchemaPropertyValidationSchema
>;
//#endregion
