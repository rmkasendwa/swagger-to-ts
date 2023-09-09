import { z } from 'zod';

import { ArraySchemaValidationSchema } from './ArraySchema';
import { BooleanSchemaValidationSchema } from './BooleanSchema';
import { NullSchemaValidationSchema } from './NullSchema';
import { NumberSchemaValidationSchema } from './NumberSchema';
import { ObjectSchemaValidationSchema } from './ObjectSchema';
import { OneOfSchemaValidationSchema } from './OneOfSchema';
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
  OneOfSchemaValidationSchema,
  RefSchemaValidationSchema,
]);

export type Schema = z.infer<typeof SchemaValidationSchema>;
//#endregion
