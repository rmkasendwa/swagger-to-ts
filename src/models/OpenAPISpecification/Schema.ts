import { z } from 'zod';

export type BaseSchema = {
  /**
   * The description of the schema.
   */
  description?: string;

  /**
   * Whether the schema is nullable or not.
   */
  nullable?: boolean;
};

export type StringSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'string';

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
};

export type NumberSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'number' | 'integer';

  /**
   * The schema property example.
   */
  example?: number;

  /**
   * The schema property default.
   */
  default?: number;

  /**
   * The schema property minimum value.
   */
  min?: number;

  /**
   * The schema property maximum value.
   */
  max?: number;
};

export type BooleanSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'boolean';

  /**
   * The schema property example.
   */
  example?: boolean;

  /**
   *
   */
  default?: boolean;
};

export type NullSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'null';

  /**
   * The schema property example.
   */
  example?: null;

  /**
   * The schema property default value.
   */
  default?: null;
};

export type RefSchema = BaseSchema & {
  /**
   * The reference schema uri.
   */
  $ref: string;

  /**
   * The reference schema summary.
   */
  summary?: string;
};

export type ObjectSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'object';

  /**
   * The schema property properties.
   */
  properties?: Record<
    string,
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RefSchema
    | OneOfSchema
    | RecordSchema
    | ObjectSchema
    | ArraySchema
  >;

  /**
   * The schema property example.
   */
  example?: any;

  /**
   * The schema property default.
   */
  default?: any;

  /**
   * The object required properties
   */
  required?: string[];

  /**
   * Whether the object allows additional properties.
   */
  additionalProperties?: boolean;
};

export type RecordSchema = BaseSchema & {
  /**
   * The schema property type.
   */
  type: 'object';

  /**
   * The record schema properties type.
   */
  additionalProperties:
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RefSchema
    | OneOfSchema
    | RecordSchema
    | ObjectSchema
    | ArraySchema;

  /**
   * The schema property example.
   */
  example?: any;

  /**
   * The schema property default.
   */
  default?: any;
};

export type OneOfSchema = BaseSchema & {
  oneOf: (
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | RefSchema
    | OneOfSchema
    | RecordSchema
    | ObjectSchema
    | ArraySchema
  )[];
};

export type ArraySchema = BaseSchema & {
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
    | RefSchema
    | OneOfSchema
    | RecordSchema
    | ObjectSchema
    | ArraySchema;

  /**
   * The schema property example.
   */
  example?: any[];

  /**
   * The schema property default.
   */
  default?: any[];
};

export const SchemaValidationSchema = z.any();

export type Schema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | RecordSchema
  | ObjectSchema
  | ArraySchema
  | OneOfSchema
  | RefSchema;
