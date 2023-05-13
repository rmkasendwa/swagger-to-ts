import { Request, RequestMethod } from './OpenAPISpecification/Request';

export const TYPESCRIPT_ENVIRONMENT_INTERFACES = ['ArrayBuffer'];
export const BINARY_RESPONSE_TYPES = ['ArrayBuffer'];

export interface TypescriptAPIGeneratorRequest extends Request {
  method: RequestMethod;
}

export interface ZodValidationSchemaProperty {
  code: string;
}

export interface SchemaCode {
  zodValidationSchemaName: string;
  zodValidationSchemaCode: Record<string, ZodValidationSchemaProperty>;
  inferedTypeCode: string;
  imports?: Record<string, string[]>;
  referencedSchemas?: string[];
  generatedVariables?: Record<string, string>;
}
