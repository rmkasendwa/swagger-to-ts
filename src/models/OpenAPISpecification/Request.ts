import { Responses } from './Response';
import { Schema } from './Schema';

export type RequestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type BaseRequestParameter = {
  required: boolean;
  name: string;
  description?: string;
  schema: Schema;
};

export type RequestParameter = {
  in: 'query' | 'header';
  required: boolean;
  name: string;
  description?: string;
  schema: Schema;
};

export type Request = {
  operationId: string;
  responses: Responses;
  description?: string;
  summary: string;
  parameters: RequestParameter[];
  tags: string[];
};
