import { Request, RequestMethod } from './Request';
import { Schema } from './Schema';

export interface Components {
  securitySchemes: Record<string, SecurityScheme>;
  schemas: Record<string, Schema>;
}

export interface OpenAPISpecificationInfo {
  version: string;
  title: string;
  description?: string;
}

export interface ApikeyAuth {
  type: string;
  in: string;
  name: string;
}

export type SecurityScheme = ApikeyAuth;

export interface Security {
  APIKeyAuth: any[];
}

export interface Tag {
  name: string;
}

export interface OpenAPISpecification {
  /**
   * The open api version.
   */
  openapi: string;

  /**
   * The open api information.
   */
  info: OpenAPISpecificationInfo;

  /**
   * The open api components.
   */
  components: Components;

  /**
   * The server security configuration.
   */
  security: Security[];

  /**
   * The server request paths.
   */
  paths: Record<string, Record<RequestMethod, Request>>;

  /**
   * The server endpoint groups.
   */
  tags: Tag[];
}
