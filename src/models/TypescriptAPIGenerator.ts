import {
  Request,
  RequestMethod,
  RequestParameter,
} from './OpenAPISpecification/Request';
import { ModuleImports } from './Utils';

export const BINARY_RESPONSE_TYPE_MODEL_NAME = 'ArrayBuffer';

export const ENVIRONMENT_DEFINED_MODELS = ['ArrayBuffer'] as const;

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

export interface TsedModelProperty {
  propertyName: string;
  propertyType: string;
  decorators: string[];
  accessModifier: 'public' | 'private' | 'protected';
  required?: boolean;
  typeDefinitionSnippet: string;
}

export interface GeneratedSchemaCodeConfiguration {
  /**
   * The name of the schema that will be created.
   */
  name: string;

  /**
   * The name of the zod validation schema that will be created.
   */
  zodValidationSchemaName: string;

  /**
   * The configuration of the zod validation schema that will be created.
   */
  zodValidationSchemaConfiguration: Record<string, ZodValidationSchemaProperty>;

  /**
   * The code that will be used to create the zod validation schema.
   */
  zodValidationSchemaCode: string;

  /**
   * The code that will be used to infer the type of the schema.
   */
  inferedTypeCode: string;

  /**
   * The imports that will be used in the generated code.
   */
  imports?: ModuleImports;

  /**
   * The schemas that are referenced by this schema.
   */
  referencedSchemas?: string[];

  /**
   * The custom variables that will be used in the generated code.
   */
  generatedVariables?: Record<string, string>;

  /**
   * The name of the tsed model that will be created.
   */
  tsedModelName?: string;

  /**
   * The configuration of the tsed model that will be created.
   */
  tsedModelConfiguration?: Record<string, TsedModelProperty>;

  /**
   * The code that will be used to create the tsed model.
   */
  tsedModelCode?: string;
}

export type RequestGroupings = Record<
  string,
  {
    imports: ModuleImports;
    requests: TypescriptAPIGeneratorRequest[];
  }
>;

export const TSED_SCHEMA_LIBRARY_PATH = `@tsed/schema`;

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
