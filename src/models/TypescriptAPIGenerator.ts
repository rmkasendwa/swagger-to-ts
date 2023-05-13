import {
  Request,
  RequestMethod,
  RequestParameter,
} from './OpenAPISpecification/Request';
import { ModuleImports } from './Utils';

export const TYPESCRIPT_ENVIRONMENT_INTERFACES = ['ArrayBuffer'];
export const BINARY_RESPONSE_TYPES = ['ArrayBuffer'];

export interface TypescriptAPIGeneratorRequest extends Request {
  method: RequestMethod;
  operationName: string;
  pascalCaseOperationName: string;
  operationDescription?: string;
  endpointPath: string;
  endpointPathName: string;
  pathParameters?: RequestParameter[];

  headerParameters?: RequestParameter[];
  headerParametersModelReference?: string;

  queryParameters?: RequestParameter[];
  queryParametersModelReference?: string;

  requestBodySchemaName?: string;
  successResponseSchemaName?: string;
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
  imports?: ModuleImports;
  referencedSchemas?: string[];
  generatedVariables?: Record<string, string>;
}

export type RequestGroupings = Record<
  string,
  {
    imports: ModuleImports;
    requests: TypescriptAPIGeneratorRequest[];
  }
>;

export const PATHS_LIBRARY_PATH = `@infinite-debugger/rmk-utils/paths`;

export const API_ADAPTER_PATH = `./Adapter`;

export type TagNameToEntityLabelsMap = Record<
  string,
  {
    'Entities Label': string;
    'Entity Label': string;

    'entities label': string;
    'entity label': string;

    PascalCaseEntities: string;
    PascalCaseEntity: string;

    camelCaseEntities: string;
    camelCaseEntity: string;

    UPPER_CASE_ENTITIES: string;
    UPPER_CASE_ENTITY: string;

    'kebab-case-entities': string;
    'kebab-case-entity': string;
  }
>;
