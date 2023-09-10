import { z } from 'zod';

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

export type NumberSchema = {
  /**
   * The schema property type.
   */
  type: 'number' | 'integer';

  /**
   * The schema property description.
   */
  description?: string;

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

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};

export type BooleanSchema = {
  /**
   * The schema property type.
   */
  type: 'boolean';

  /**
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property example.
   */
  example?: boolean;

  /**
   *
   */
  default?: boolean;

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};

export type NullSchema = {
  /**
   * The schema property type.
   */
  type: 'null';

  /**
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property example.
   */
  example?: null;

  /**
   * The schema property default value.
   */
  default?: null;
};

export type RefSchema = {
  /**
   * The reference schema uri.
   */
  $ref: string;

  /**
   * The reference schema summary.
   */
  summary?: string;

  /**
   * The reference schema description.
   */
  description?: string;
};

export type ObjectSchema = {
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
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property example.
   */
  example?: any;

  /**
   * The schema property default.
   */
  default?: any;

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;

  /**
   * The object required properties
   */
  required?: string[];
};

export type RecordSchema = {
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
   * The schema property description.
   */
  description?: string;

  /**
   * The schema property example.
   */
  example?: any;

  /**
   * The schema property default.
   */
  default?: any;

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};

export type OneOfSchema = {
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

  /**
   * The schema property description.
   */
  description?: string;

  /**
   * Whether the schema property is nullable or not.
   */
  nullable?: boolean;
};

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
    | RefSchema
    | OneOfSchema
    | RecordSchema
    | ObjectSchema
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
