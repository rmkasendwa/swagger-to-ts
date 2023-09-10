import { z } from 'zod';

import { ArraySchema } from './ArraySchema';
import { BooleanSchema, BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchema, NullSchemaValidationSchema } from './NullSchema';
import { NumberSchema, NumberSchemaValidationSchema } from './NumberSchema';
import { OneOfSchema } from './OneOfSchema';
import { RefSchema, RefSchemaValidationSchema } from './RefSchema';
import { StringSchema, StringSchemaValidationSchema } from './StringSchema';

export const ObjectSchemaValidationSchema = z.object({
  type: z.literal('object').describe('The schema property type.'),
  properties: z
    .record(
      z.union([
        StringSchemaValidationSchema,
        NumberSchemaValidationSchema,
        BooleanSchemaValidationSchema,
        NullSchemaValidationSchema,
        RefSchemaValidationSchema,

        //#region OneOfSchema
        z.object({
          oneOf: z
            .array(
              z.union([
                StringSchemaValidationSchema,
                NumberSchemaValidationSchema,
                BooleanSchemaValidationSchema,
                NullSchemaValidationSchema,
                RefSchemaValidationSchema,
              ])
            )
            .describe('The schema property one of.'),
          description: z
            .string()
            .optional()
            .describe('The schema property description.'),
          nullable: z
            .boolean()
            .optional()
            .describe('Whether the schema property is nullable or not.'),
        }),
        //#endregion

        //#region Array Schema
        z.object({
          type: z.literal('array').describe('The schema property type.'),
          items: z
            .union([
              StringSchemaValidationSchema,
              NumberSchemaValidationSchema,
              BooleanSchemaValidationSchema,
              NullSchemaValidationSchema,
              RefSchemaValidationSchema,
            ])
            .optional()
            .describe('The schema property items.'),
          description: z
            .string()
            .optional()
            .describe('The schema property description.'),
          example: z
            .array(z.any())
            .optional()
            .describe('The schema property example.'),
          default: z
            .array(z.any())
            .optional()
            .describe('The schema property default.'),
          nullable: z
            .boolean()
            .optional()
            .describe('Whether the schema property is nullable or not.'),
        }),
        //#endregion
      ])
    )
    .optional()
    .describe('The schema property properties.'),
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
  required: z
    .array(z.string())
    .optional()
    .describe('The schema property required properties.'),
});

export type ObjectSchema = {
  type: 'object';
  properties?: Record<
    string,
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RefSchema
    | OneOfSchema
    | ArraySchema
  >;
  description?: string;
  example?: any;
  default?: any;
  nullable?: boolean;
  required?: string[];
};
