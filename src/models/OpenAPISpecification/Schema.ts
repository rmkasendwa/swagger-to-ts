export type StringSchemaProperty = {
  type: 'string';
  description?: string;
  format?: 'date' | 'date-time';
  minLength?: number;
  example?: string;
  default?: string;
};

export type NumberSchemaProperty = {
  type: 'number';
  description?: string;
  example?: number;
  default?: number;
};

export type BooleanSchemaProperty = {
  type: 'string';
  description?: string;
  enum?: string[];
  minLength?: number;
  example?: string;
  default?: string;
};

export type ArraySchemaProperty = {
  type: 'array';
  items: SchemaProperty;
  description?: string;
  example?: any[];
  default?: any[];
};

export type RefSchemaProperty = {
  $ref: string;
};

export type SchemaProperty =
  | StringSchemaProperty
  | NumberSchemaProperty
  | BooleanSchemaProperty
  | ArraySchemaProperty
  | RefSchemaProperty;

export type Schema = {
  type: 'object';
  properties: Record<string, SchemaProperty>;

  /**
   * The required properties
   */
  required: string[];
};
