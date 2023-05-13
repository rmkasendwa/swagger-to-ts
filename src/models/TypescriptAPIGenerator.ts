import { Request, RequestMethod } from './OpenAPISpecification/Request';

export const TYPESCRIPT_ENVIRONMENT_INTERFACES = ['ArrayBuffer'];
export const BINARY_RESPONSE_TYPES = ['ArrayBuffer'];

export interface TypescriptAPIGeneratorRequest extends Request {
  method: RequestMethod;
  operationName: string;
  requestPath: string;
}

export interface ZodValidationSchemaProperty {
  code: string;
}

export interface GeneratedSchemaCodeConfiguration {
  name: string;
  zodValidationSchemaName: string;
  zodValidationSchemaConfiguration: Record<string, ZodValidationSchemaProperty>;
  zodValidationSchemaCode: string;
  inferedTypeCode: string;
  imports?: Record<string, string[]>;
  referencedSchemas?: string[];
  generatedVariables?: Record<string, string>;
}
