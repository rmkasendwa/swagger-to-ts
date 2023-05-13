import { Schema } from './Schema';

export type JsonContent = {
  'application/json': {
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

export type Content = JsonContent | GenericContent;
