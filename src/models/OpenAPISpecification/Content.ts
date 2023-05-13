import { Schema } from './Schema';

export type JSONContent = {
  'application/json': {
    schema:
      | {
          $ref: string;
        }
      | Schema;
  };
};

export type PNGContent = {
  'image/png': {
    schema:
      | {
          $ref: string;
        }
      | Schema;
  };
};

export type GenericContent = {
  '*/*': {
    schema: {
      type: string;
    };
  };
};

export type Content = JSONContent | PNGContent | GenericContent;
