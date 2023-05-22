import '@infinite-debugger/rmk-js-extensions/String';

import { existsSync } from 'fs';

import {
  ensureDirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs-extra';
import prettier from 'prettier';
import walkSync from 'walk-sync';
import { z } from 'zod';

import { pkg } from '../config';
import {
  OpenAPISpecification,
  OpenAPISpecificationValidationSchema,
} from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  RequestGroupings,
  SuccessResponseSchema,
  TagNameToEntityLabelsMap,
} from '../models/TypescriptAPIGenerator';
import {
  getAPIAdapterCode,
  getAPIFunctionsCodeConfiguration,
} from './APIFunctionsCodeGenerator';
import {
  GenerateModelMappingsOptions,
  generateModelMappings,
} from './ModelCodeGenerator';
import { generateSchemaFromRequestParameters } from './SchemaGenerator';
import {
  GenerateTSEDControllersCodeConfigurationOptions,
  getTSEDControllersCodeConfiguration,
} from './TSEDControllersCodeGenerator';
import { getGeneratedFileWarningComment, getImportsCode } from './Utils';

export const RequestOperationNameSourceValidationSchema = z.enum([
  'requestSummary',
  'requestOperationId',
] as const);

export type RequestOperationNameSource = z.infer<
  typeof RequestOperationNameSourceValidationSchema
>;

export interface GenerateTypescriptAPIOptions
  extends Pick<GenerateModelMappingsOptions, 'inferTypeFromValidationSchema'>,
    Pick<
      GenerateTSEDControllersCodeConfigurationOptions,
      'tsedControllerNamePrefix' | 'tsedControllerNameSuffix'
    > {
  /**
   * The OpenAPI specification to generate the Typescript API from.
   */
  openAPISpecification: OpenAPISpecification;

  /**
   * The root path to output the generated Typescript API to.
   */
  outputRootPath: string;

  /**
   * Whether to output the internal state of the Typescript API generator.
   */
  outputInternalState?: boolean;

  /**
   * The source to use for the operation name of each request.
   */
  requestOperationNameSource?: RequestOperationNameSource;

  /**
   * Whether to generate TSED controllers.
   */
  generateTsEDControllers?: boolean;

  /**
   * The import path to use for the Ts.ED `Authenticate` decorator.
   */
  tsEDAuthenticateDecoratorImportPath?: string;
}

export const generateTypescriptAPI = async ({
  openAPISpecification: inputOpenAPISpecification,
  outputRootPath,
  outputInternalState = false,
  generateTsEDControllers = false,
  requestOperationNameSource = 'requestSummary',
  inferTypeFromValidationSchema,
  tsEDAuthenticateDecoratorImportPath,
  tsedControllerNamePrefix,
  tsedControllerNameSuffix,
}: GenerateTypescriptAPIOptions) => {
  //#region Validate OpenAPI specification
  console.log('\n🔍 Validate OpenAPI specification.');
  const debugOutputFolderName = `__${pkg.name
    .replace(/\//g, ' ')
    .toSnakeCase()}_debug_output__/${new Date()
    .toISOString()
    .replace(/:/g, '_')}`;
  const debugOutputRootPath = `${outputRootPath}/${debugOutputFolderName}`;
  const openAPISpecification = (() => {
    try {
      console.log(' -> 🔍 Validating OpenAPI specification...');
      return OpenAPISpecificationValidationSchema.parse(
        inputOpenAPISpecification
      );
    } catch (err) {
      const errorFilePath = `${debugOutputRootPath}/openapi_spec_validation.error.json`;
      ensureDirSync(debugOutputRootPath);
      console.error(
        `😞 Oops! Something went wrong while validating your OpenAPI specification. See ${errorFilePath} for details.`
      );
      writeFileSync(errorFilePath, JSON.stringify(err, null, 2));
      process.exit(1);
    }
  })();
  console.log(' -> 👍 OpenAPI specification is valid.');
  //#endregion

  //#region Initialization
  console.log('\n🚀 Generate Typescript API.');
  const clientName = openAPISpecification.info.title.toTitleCase();
  const autogeneratedFileWarningComment = getGeneratedFileWarningComment();
  //#endregion

  //#region Find all requests and group them by tag
  console.log(` -> Grouping API requests by tag...`);
  const requestGroupings = Object.keys(openAPISpecification.paths).reduce(
    (accumulator, path) => {
      Object.keys(openAPISpecification.paths[path]).forEach((method) => {
        const request =
          openAPISpecification.paths[path][method as RequestMethod];

        //#region Generate anonymous schemas for all responses and request bodies that are not referenced by any other schema
        const { requestBody } = request;
        const operationName = (() => {
          if (
            requestOperationNameSource === 'requestSummary' &&
            request.summary
          ) {
            return request.summary.toCamelCase();
          }
          if (request.operationId) {
            return request.operationId;
          }
          throw new Error('Could not determine operation name.');
        })();
        const pascalCaseOperationName = operationName.toPascalCase();
        if (requestBody) {
          const { content } = requestBody;
          if (
            content &&
            'application/json' in content &&
            'type' in content['application/json'].schema &&
            content['application/json'].schema.type === 'object'
          ) {
            const schemaName = `${pascalCaseOperationName}RequestPayload`;
            openAPISpecification.components.schemas[schemaName] =
              content['application/json'].schema;

            (requestBody.content as any)['application/json'].schema = {
              $ref: `#/components/schemas/${schemaName}`,
            };
          }
        }
        //#endregion

        request.tags.forEach((tag) => {
          if (!accumulator[tag]) {
            accumulator[tag] = {
              imports: {},
              requests: [],
            };
          }

          const { requests } = accumulator[tag];

          requests.push({
            ...request,
            method: method as RequestMethod,
            requestPath: path,
            operationName,
            pascalCaseOperationName,
            requestPathName:
              (() => {
                if (
                  requestOperationNameSource === 'requestSummary' &&
                  request.summary
                ) {
                  return request.summary.replace(/\s/g, '_').toUpperCase();
                }
                if (request.operationId) {
                  return request.operationId.replace(/\s/g, '_').toUpperCase();
                }
                throw new Error('Could not determine operation name.');
              })() + `_ENDPOINT_PATH`,
            operationDescription: (() => {
              if (
                requestOperationNameSource === 'requestSummary' &&
                request.summary
              ) {
                const [verb, ...restSummary] = request.summary.split(' ');
                return (
                  verb.replace(/[ei]+$/g, '') + 'ing ' + restSummary.join(' ')
                );
              }
            })(),
            requestBodySchemaName: (() => {
              if (
                request.requestBody?.content &&
                'application/json' in request.requestBody.content &&
                '$ref' in request.requestBody.content['application/json'].schema
              ) {
                const requestBodySchemaName = request.requestBody.content[
                  'application/json'
                ].schema.$ref.replace('#/components/schemas/', '');
                return requestBodySchemaName;
              }
            })(),
            ...(() => {
              if (request.requestBody?.content) {
                const { content } = request.requestBody;
                if (
                  'application/json' in content &&
                  'type' in content['application/json'].schema &&
                  content['application/json'].schema.type === 'array'
                ) {
                  const { schema } = content['application/json'];
                  if (schema.items) {
                    if ('$ref' in schema.items) {
                      const requestBodySchemaName = schema.items.$ref.replace(
                        '#/components/schemas/',
                        ''
                      );
                      return {
                        requestBodyType: `${requestBodySchemaName}[]`,
                        requestBodyTypeDependentSchemaName:
                          requestBodySchemaName,
                      };
                    }
                    if (
                      schema.items.type &&
                      (
                        [
                          'boolean',
                          'number',
                          'string',
                        ] as (typeof schema.items.type)[]
                      ).includes(schema.items.type)
                    ) {
                      return {
                        requestBodyType: `${schema.items.type}[]`,
                      };
                    }
                  }
                  return {
                    requestBodyType: 'any[]',
                  };
                }
              }
            })(),
            successResponseSchemas: (() => {
              const successResponses = Object.keys(request.responses).filter(
                (responseCode) => responseCode.startsWith('2')
              );
              if (successResponses && successResponses.length > 0) {
                return successResponses
                  .filter((successResponse) => {
                    return request.responses[successResponse].content;
                  })
                  .map((successResponse) => {
                    if (
                      'application/json' in
                        request.responses[successResponse].content &&
                      request.responses[successResponse].content[
                        'application/json'
                      ].schema &&
                      '$ref' in
                        request.responses[successResponse].content[
                          'application/json'
                        ].schema
                    ) {
                      const successResponseSchemaName = (
                        request.responses[successResponse] as any
                      ).content['application/json'].schema.$ref.replace(
                        '#/components/schemas/',
                        ''
                      );
                      return {
                        name: successResponseSchemaName,
                        httpStatusCode: +successResponse,
                        description:
                          request.responses[successResponse].description,
                      } as SuccessResponseSchema;
                    }
                    if (
                      'image/png' in request.responses[successResponse].content
                    ) {
                      return {
                        name: BINARY_RESPONSE_TYPE_MODEL_NAME,
                        description:
                          request.responses[successResponse].description,
                        httpStatusCode: +successResponse,
                      } as SuccessResponseSchema;
                    }
                    if ('*/*' in request.responses[successResponse].content!) {
                      return {
                        type: 'string',
                        description:
                          request.responses[successResponse].description,
                        httpStatusCode: +successResponse,
                      } as SuccessResponseSchema;
                    }
                  })
                  .filter((schema) => schema) as SuccessResponseSchema[];
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const pathParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'path'
                );
                if (pathParameters.length > 0) {
                  return {
                    pathParameters,
                  };
                }
              }
            })(),

            //#region Header parameters
            ...(() => {
              if (request.parameters) {
                const headerParameters = request.parameters.filter(
                  (parameter) => {
                    return (
                      parameter.in === 'header' &&
                      !parameter.name.match(/authorization/gi)
                    );
                  }
                );
                if (headerParameters.length > 0) {
                  const headerParametersModelReference = `${pascalCaseOperationName}HeaderParams`;
                  openAPISpecification.components.schemas[
                    headerParametersModelReference
                  ] = generateSchemaFromRequestParameters({
                    requestParameters: headerParameters,
                  });
                  return {
                    headerParameters,
                    headerParametersModelReference,
                  };
                }
              }
            })(),
            //#endregion

            //#region Query parameters
            ...(() => {
              if (request.parameters) {
                const queryParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'query'
                );
                if (queryParameters.length > 0) {
                  const queryParametersModelReference = `${pascalCaseOperationName}QueryParams`;
                  openAPISpecification.components.schemas[
                    queryParametersModelReference
                  ] = generateSchemaFromRequestParameters({
                    requestParameters: queryParameters,
                  });
                  return {
                    queryParameters,
                    queryParametersModelReference,
                  };
                }
              }
            })(),
            //#endregion
          });
        });
      });
      return accumulator;
    },
    {} as RequestGroupings
  );
  //#endregion

  //#region Generate tag to entity mappings
  console.log(` -> Generating tag to entity mappings...`);
  const tagToEntityLabelMappings = [
    ...Object.keys(requestGroupings),
    'Utils',
  ].reduce((accumulator, tag) => {
    const labelPlural = tag;
    const labelSingular = (() => {
      if (tag.endsWith('s')) {
        return tag.slice(0, -1);
      }
      return tag;
    })();
    accumulator[tag] = {
      'Entities Label': labelPlural,
      'Entity Label': labelSingular,

      'entities label': labelPlural.toLowerCase(),
      'entity label': labelSingular.toLowerCase(),

      PascalCaseEntities: labelPlural.toPascalCase(),
      PascalCaseEntity: labelSingular.toPascalCase(),

      camelCaseEntities: labelPlural.toCamelCase(),
      camelCaseEntity: labelSingular.toCamelCase(),

      UPPER_CASE_ENTITIES: labelPlural.replace(/\s/g, '_').toUpperCase(),
      UPPER_CASE_ENTITY: labelSingular.replace(/\s/g, '_').toUpperCase(),

      'kebab-case-entities': labelPlural.toKebabCase(),
      'kebab-case-entity': labelSingular.toKebabCase(),
    };
    return accumulator;
  }, {} as TagNameToEntityLabelsMap);
  //#endregion

  //#region Generate model mappings.
  console.log(` -> Generating model mappings...`);
  const {
    entitySchemaGroups,
    schemaToEntityMappings,
    schemaEntityReferences,
    models,
    modelsToValidationSchemaMappings,
  } = generateModelMappings({
    requestGroupings,
    openAPISpecification: openAPISpecification as any,
    generateTsEDControllers,
    inferTypeFromValidationSchema,
  });
  //#endregion

  //#region Generate API functions code configuration
  console.log(` -> Generating API functions code configuration...`);
  const apiFunctionsCodeConfiguration = getAPIFunctionsCodeConfiguration({
    requestGroupings,
    modelsToValidationSchemaMappings,
    schemaToEntityMappings,
    tagToEntityLabelMappings,
  });
  //#endregion

  //#region Generate TSED controllers code configuration
  const tsedControllersCodeConfiguration = (() => {
    if (generateTsEDControllers) {
      return getTSEDControllersCodeConfiguration({
        requestGroupings,
        schemaToEntityMappings,
        tagToEntityLabelMappings,
        authenticateDecoratorImportPath: tsEDAuthenticateDecoratorImportPath,
        tsedControllerNamePrefix,
        tsedControllerNameSuffix,
      });
    }
  })();
  //#endregion

  //#region Clean up output folder
  console.log(` -> Cleaning up output folder...`);
  if (existsSync(outputRootPath)) {
    walkSync(outputRootPath, {
      includeBasePath: true,
      directories: false,
    }).forEach((filePath) => {
      const fileContents = readFileSync(filePath, 'utf8');
      if (
        fileContents.match(`automatically generated by the ${pkg.name} library`)
      ) {
        console.log(`    -> Removing file: ${filePath}`);
        unlinkSync(filePath);
      }
    });
  }
  //#endregion

  //#region Write debug output files
  if (outputInternalState) {
    console.log(` -> Writing debug output files...`);
    ensureDirSync(debugOutputRootPath);
    writeFileSync(
      `${debugOutputRootPath}/api_request_groupped_by_tag.debug.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/tag_to_entity_mappings.debug.json`,
      JSON.stringify(tagToEntityLabelMappings, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/schema_references.debug.json`,
      JSON.stringify(schemaEntityReferences, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/schema_to_entity_mappings.debug.json`,
      JSON.stringify(schemaToEntityMappings, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/schemas_grouped_by_tag.debug.json`,
      JSON.stringify(entitySchemaGroups, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/validation_schemas.debug.json`,
      JSON.stringify(models, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/models_to_validation_schema_mappings.debug.json`,
      JSON.stringify(modelsToValidationSchemaMappings, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/api_functions_code_configuration.debug.json`,
      JSON.stringify(apiFunctionsCodeConfiguration, null, 2)
    );
  }
  //#endregion

  //#region Write model files
  console.log(` -> Writing model files...`);
  const modelsOutputFilePath = `${outputRootPath}/models`;
  ensureDirSync(modelsOutputFilePath);
  Object.keys(models).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const modelFileName = `${PascalCaseEntities}.ts`;
    const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;

    const entityModelsOutputCode = Object.values(models[tag].models)
      .map((model) => model.zodValidationSchemaCode)
      .join('\n\n');

    writeFileSync(
      entityModelsOutputFilePath,
      prettier.format(
        [
          autogeneratedFileWarningComment,
          ...getImportsCode({
            imports: models[tag].imports,
          }),
          entityModelsOutputCode,
        ].join('\n\n'),
        {
          filepath: entityModelsOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  });

  const modelsIndexOutputFilePath = `${modelsOutputFilePath}/index.ts`;
  writeFileSync(
    modelsIndexOutputFilePath,
    prettier.format(
      `${autogeneratedFileWarningComment}\n\n` +
        Object.keys(models)
          .map((tag) => {
            return `export * from './${tagToEntityLabelMappings[tag].PascalCaseEntities}';`;
          })
          .join('\n'),
      {
        filepath: modelsIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write API files
  console.log(` -> Writing API files...`);
  const apiOutputFilePath = `${outputRootPath}/api`;
  ensureDirSync(apiOutputFilePath);
  Object.keys(apiFunctionsCodeConfiguration).forEach((tag) => {
    const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
    const apiFileName = `${PascalCaseEntities}.ts`;
    const entityAPIOutputFilePath = `${apiOutputFilePath}/${apiFileName}`;
    const { outputCode, requestPathsOutputCode, imports, dataKeyVariableName } =
      apiFunctionsCodeConfiguration[tag];

    writeFileSync(
      entityAPIOutputFilePath,
      prettier.format(
        [
          autogeneratedFileWarningComment,
          ...getImportsCode({
            imports,
          }),
          `
            //#region Endpoint Paths
            ${requestPathsOutputCode}
            //#endregion
          `.trimIndent(),
          `
            //#region Data Keys
            export const ${dataKeyVariableName} = '${tagToEntityLabelMappings[tag].PascalCaseEntities}';
            //#endregion
          `.trimIndent(),
          `
            //#region API
            ${outputCode}
            //#endregion
          `.trimIndent(),
        ].join('\n\n'),
        {
          filepath: entityAPIOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  });

  const apiAdapterOutputFilePath = `${apiOutputFilePath}/Adapter.ts`;
  if (!existsSync(apiAdapterOutputFilePath)) {
    writeFileSync(
      apiAdapterOutputFilePath,
      prettier.format(
        `${autogeneratedFileWarningComment}\n\n${getAPIAdapterCode()}`,
        {
          filepath: apiAdapterOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  }

  const apiIndexOutputFilePath = `${apiOutputFilePath}/index.ts`;
  writeFileSync(
    apiIndexOutputFilePath,
    prettier.format(
      `${autogeneratedFileWarningComment}\n\n` +
        [
          ...Object.keys(requestGroupings).map((tag) => {
            return tagToEntityLabelMappings[tag].PascalCaseEntities;
          }),
          'Adapter',
        ]
          .map((PascalCaseEntities) => {
            return `export * from './${PascalCaseEntities}';`;
          })
          .join('\n'),
      {
        filepath: apiIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write TSED controller files
  if (generateTsEDControllers && tsedControllersCodeConfiguration) {
    console.log(` -> Writing TSED controller files...`);
    const tsedControllersOutputFilePath = `${outputRootPath}/controllers`;
    ensureDirSync(tsedControllersOutputFilePath);
    Object.keys(tsedControllersCodeConfiguration).forEach((tag) => {
      const { PascalCaseEntity } = tagToEntityLabelMappings[tag];
      const controllerFileName = `${PascalCaseEntity}Controller.ts`;
      const controllerOutputFilePath = `${tsedControllersOutputFilePath}/${controllerFileName}`;
      const { outputCode, imports } = tsedControllersCodeConfiguration[tag];

      writeFileSync(
        controllerOutputFilePath,
        prettier.format(
          [
            autogeneratedFileWarningComment,
            ...getImportsCode({
              imports,
            }),
            outputCode,
          ].join('\n\n'),
          {
            filepath: controllerOutputFilePath,
            ...prettierConfig,
          }
        )
      );
    });

    const tsedControllersIndexOutputFilePath = `${tsedControllersOutputFilePath}/index.ts`;
    writeFileSync(
      tsedControllersIndexOutputFilePath,
      prettier.format(
        `${autogeneratedFileWarningComment}\n\n` +
          Object.keys(requestGroupings)
            .map((tag) => {
              return tagToEntityLabelMappings[tag].PascalCaseEntity;
            })
            .map((PascalCaseEntity) => {
              return `export * from './${PascalCaseEntity}Controller';`;
            })
            .join('\n'),
        {
          filepath: tsedControllersIndexOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  }
  //#endregion

  //#region Write index file
  console.log(`\nFinish`);
  console.log(` -> Writing index file...`);
  const indexOutputFilePath = `${outputRootPath}/index.ts`;
  if (!existsSync(indexOutputFilePath)) {
    writeFileSync(
      indexOutputFilePath,
      prettier.format(
        `${autogeneratedFileWarningComment}\n\n` +
          [
            'api',
            'models',
            ...(() => {
              if (generateTsEDControllers) {
                return ['controllers'];
              }
              return [];
            })(),
          ]
            .map((folderName) => {
              return `export * from './${folderName}';`;
            })
            .join('\n'),
        {
          filepath: indexOutputFilePath,
          ...prettierConfig,
        }
      )
    );
  }
  //#endregion

  console.log(
    ` -> ✅ Success. ${clientName} typescript client code has been generated in the following directory ${outputRootPath}`
  );
};
