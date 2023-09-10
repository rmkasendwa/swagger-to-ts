import { z } from 'zod';

import { BooleanSchema, BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchema, NullSchemaValidationSchema } from './NullSchema';
import { NumberSchema, NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchema, ObjectSchemaValidationSchema } from './ObjectSchema';
import { RecordSchema, RecordSchemaValidationSchema } from './RecordSchema';
import { RefSchema, RefSchemaValidationSchema } from './RefSchema';
import { StringSchema, StringSchemaValidationSchema } from './StringSchema';

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

export type ArraySchema = {
  /**
   * The schema property type.
   */
  type: 'array';

  /**
   * The schema property items.
   */
  items?:
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RecordSchema
    | ObjectSchema
    | RefSchema
    | ArraySchema;

  /**
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property example.
   */
  example?: any[];

  /**
   * The schema property default.
   */
  default?: any[];

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};
//#endregion
