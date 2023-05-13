import { Content } from './Content';
import { Responses } from './Response';
import { Schema, SchemaProperty } from './Schema';

export type RequestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type BaseRequestParameter = {
  required: boolean;
  name: string;
  description?: string;
  schema: Schema;
};

export type RequestParameter = {
  in: 'query' | 'header' | 'path';
  required: boolean;
  name: string;
  description?: string;
  schema: SchemaProperty;
};

export type RequestBody = {
  required: boolean;
  content: Content;
  description?: string;
};

export type Request = {
  description?: string;
  operationId: string;
  parameters?: RequestParameter[];
  requestBody?: RequestBody;
  responses: Responses;
  summary?: string;
  tags: string[];
};
