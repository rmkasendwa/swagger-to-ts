import { Content } from './Content';

export type Response = {
  content: Content;
  description?: string;
};

export type Responses = Record<string, Response>;
