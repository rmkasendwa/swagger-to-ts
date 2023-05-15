import {
  Request,
  RequestMethod,
  RequestParameter,
} from './OpenAPISpecification/Request';
import { SchemaProperty } from './OpenAPISpecification/Schema';
import { ModuleImports } from './Utils';

export const BINARY_RESPONSE_TYPE_MODEL_NAME = 'ArrayBuffer';

export const ENVIRONMENT_DEFINED_MODELS = ['ArrayBuffer'] as const;

export interface TypescriptAPIGeneratorRequest extends Request {
  /**
   * The HTTP method of the request.
   */
  method: RequestMethod;

  /**
   * The name of the operation.
   * This is the name of the operation as defined in the OpenAPI specification.
   */
  operationName: string;

  /**
   * The name of the operation in PascalCase.
   */
  pascalCaseOperationName: string;

  /**
   * The description of the request.
   */
  operationDescription?: string;

  /**
   * The endpoint path of the request.
   */
  requestPath: string;

  /**
   * The name of the variable that is used to store the endpoint path.
   */
  requestPathName: string;

  /**
   * The path parameters in the endpoint path.
   */
  pathParameters?: RequestParameter[];

  /**
   * The parameters in the headers of the request.
   */
  headerParameters?: RequestParameter[];

  /**
   * The reference the model that is used to define the header parameters.
   */
  headerParametersModelReference?: string;

  /**
   * The query parameters in the endpoint path.
   */
  queryParameters?: RequestParameter[];

  /**
   * The reference the model that is used to define the query parameters.
   */
  queryParametersModelReference?: string;

  /**
   * The name of the model that is used to define the body of the request.
   */
  requestBodySchemaName?: string;

  /**
   * The type of the body of the request. This is provided if requestBodySchemaName is not provided.
   */
  requestBodyType?: string;

  /**
   * The name of the model that the requestBody type is dependent on.
   */
  requestBodyTypeDependentSchemaName?: string;

  /**
   * The name of the model that is used to define the response of the request.
   */
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
  openAPISpecification: SchemaProperty;
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

export const TSED_COMMON_LIBRARY_PATH = `@tsed/common`;

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
