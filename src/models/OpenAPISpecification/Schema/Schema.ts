import { z } from 'zod';

import { AnyOfSchemaValidationSchema } from './AnyOfSchema';
import { ArraySchemaValidationSchema } from './ArraySchema';
import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchemaValidationSchema } from './ObjectSchema';
import { RecordSchemaValidationSchema } from './RecordSchema';
import { RefSchemaValidationSchema } from './RefSchema';
import { StringSchemaValidationSchema } from './StringSchema';

//#region Schema
export const SchemaValidationSchema = z.union([
  StringSchemaValidationSchema,
  NumberSchemaValidationSchema,
  BooleanSchemaValidationSchema,
  NullSchemaValidationSchema,
  RecordSchemaValidationSchema,
  ObjectSchemaValidationSchema,
  ArraySchemaValidationSchema,
  AnyOfSchemaValidationSchema,
  RefSchemaValidationSchema,
]);

export type Schema = z.infer<typeof SchemaValidationSchema>;
//#endregion
