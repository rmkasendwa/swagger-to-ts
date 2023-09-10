import {
  Request,
  RequestMethod,
  RequestParameter,
} from './OpenAPISpecification/Request';
import { Schema } from './OpenAPISpecification/Schema';
import { ModuleImports } from './Utils';

export const BINARY_RESPONSE_TYPE_MODEL_NAME = 'ArrayBuffer';

export const ENVIRONMENT_DEFINED_MODELS = ['ArrayBuffer'] as const;

export interface SuccessResponseBaseSchema {
  /**
   * The description of the response.
   */
  description?: string;

  /**
   * The HTTP status code of the response.
   */
  httpStatusCode: number;

  /**
   * Whether the response is an array or not.
   */
  isArray?: boolean;
}

export interface SuccessResponseModelSchema extends SuccessResponseBaseSchema {
  /**
   * The name of the model that is used to define the response.
   */
  name: string;
}

export interface SuccessResponseTypeSchema extends SuccessResponseBaseSchema {
  /**
   * The type of the response.
   */
  type: string;
}

export type SuccessResponseSchema =
  | SuccessResponseModelSchema
  | SuccessResponseTypeSchema;

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
  successResponseSchemas?: SuccessResponseSchema[];
}

export interface ZodValidationSchemaProperty {
  code: string;
}

export interface TsedModelProperty {
  /**
   * The name of the property.
   */
  propertyName: string;

  /**
   * The type of the property.
   */
  propertyType: string;

  /**
   * The list of models that represent the property.
   */
  propertyModels: string[];

  /**
   * The list of decorators that will be used to decorate the property.
   */
  decorators: string[];

  /**
   * The access modifier of the property.
   */
  accessModifier: 'public' | 'private' | 'protected';

  /**
   * Whether the property is required.
   */
  required?: boolean;

  /**
   * The full code of the property.
   */
  typeDefinitionSnippet: string;

  /**
   * The open api specification of the property.
   */
  openAPISpecification: Schema;

  /**
   * Whether the property is nullable or not.
   */
  isNullable?: boolean;
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
   * The code that will be used to create the tsed model.
   */
  tsedModelCode?: string;
}

export type RequestGroupings = {
  [tagName: string]: {
    /**
     * The tag group module imports.
     */
    imports: ModuleImports;

    /**
     * The requests that are grouped under this tag/module.
     */
    requests: TypescriptAPIGeneratorRequest[];
  };
};

/**
 * The request scope groupings.
 * The keys are the names of the scopes.
 *
 * @example
 * ```typescript
 * {
 *   "Root": {
 *   }
 * }
 * ```
 */
export type RequestScopeGroupings = {
  [scopeName: string]: RequestGroupings;
};

export type ModelMappings = {
  /**
   * The entity schema groups.
   */
  entitySchemaGroups: Record<string, string[]>;

  /**
   * The schmea to entity mappings.
   */
  schemaToEntityMappings: Record<string, string>;

  /**
   * The schema entity references.
   */
  schemaEntityReferences: Record<string, string[]>;

  /**
   * The model to validation schema mappings.
   */
  models: {
    [modelName: string]: {
      models: Record<string, GeneratedSchemaCodeConfiguration>;
      imports?: ModuleImports | undefined;
    };
  };

  /**
   * The models to validation schema mappings.
   */
  modelsToValidationSchemaMappings: {
    [modelName: string]: GeneratedSchemaCodeConfiguration;
  };
};

export type APIFunctionsCodeConfiguration = {
  [requestPath: string]: {
    requestPathsOutputCode: string;
    outputCode: string;
    imports: ModuleImports;
    dataKeyVariableName: string;
    exports: string[];
  };
};

export type TSEDControllersCodeConfiguration = {
  [requestPath: string]: {
    outputCode: string;
    imports: ModuleImports;
  };
};

export const TSED_SCHEMA_LIBRARY_PATH = `@tsed/schema`;
export const TSED_COMMON_LIBRARY_PATH = `@tsed/common`;
export const TSED_DEPENDENCY_INJECTION_LIBRARY_PATH = `@tsed/di`;
export const TSED_SWAGGER_LIBRARY_PATH = `@tsed/swagger`;
export const RMK_UTILS_LIBRARY_PATH = `@infinite-debugger/rmk-utils`;
export const PATHS_LIBRARY_PATH = `@infinite-debugger/rmk-utils/paths`;

export type TagNameToEntityLabelsMap = {
  [tagName: string]: {
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
  };
};

export const primitiveTypes = [
  'string',
  'number',
  'boolean',
  'null',
  'undefined',
] as const;

export const primitiveTypeModels = ['String', 'Number', 'Boolean'] as const;

export const primitiveTypeToModelMapping = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
};
