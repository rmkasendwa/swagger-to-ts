import { z } from 'zod';

import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchemaValidationSchema } from './ObjectSchema';
import { RecordSchemaValidationSchema } from './RecordSchema';
import { RefSchemaValidationSchema } from './RefSchema';
import { StringSchemaValidationSchema } from './StringSchema';

//#region ArraySchemaProperty
export const ArraySchemaValidationSchema = z.object({
  type: z.literal('array').describe('The schema property type.'),
  items: z
    .union([
      StringSchemaValidationSchema,
      NumberSchemaValidationSchema,
      BooleanSchemaValidationSchema,
      NullSchemaValidationSchema,
      RecordSchemaValidationSchema,
      ObjectSchemaValidationSchema,
      RefSchemaValidationSchema,
    ])
    .optional()
    .describe('The schema property items.'),
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

export type ArraySchema = z.infer<typeof ArraySchemaValidationSchema>;
//#endregion
