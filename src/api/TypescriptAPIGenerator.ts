import '@infinite-debugger/rmk-js-extensions/String';

import { existsSync } from 'fs';

import {
  ensureDirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs-extra';
import pluralize from 'pluralize';
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
  APIFunctionsCodeConfiguration,
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  ModelMappings,
  RequestGroupings,
  RequestScopeGroupings,
  SuccessResponseSchema,
  TSEDControllersCodeConfiguration,
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
import { prefixModelsAndModelReferences } from './ModelPrefixer';
import { generateSchemaFromRequestParameters } from './SchemaGenerator';
import {
  GenerateTSEDControllersCodeConfigurationOptions,
  getTSEDControllersCodeConfiguration,
} from './TSEDControllersCodeGenerator';
import {
  cleanEmptyFoldersRecursively,
  getGeneratedFileWarningComment,
  getImportsCode,
} from './Utils';

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

  /**
   * The scope name to use for the generated Typescript API.
   */
  scopeName?: string;
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
  scopeName,
}: GenerateTypescriptAPIOptions) => {
  //#region Validate OpenAPI specification
  console.log('\n🔍 Validate OpenAPI specification.');
  const debugOutputFolderName = `__${pkg.name
    .replace(/\//g, ' ')
    .toSnakeCase()}_debug_output__/${new Date()
    .toISOString()
    .replace(/:/g, '_')}`;
  const debugOutputRootPath = `${outputRootPath}/${debugOutputFolderName}`;
  const validOpenAPISpecification: OpenAPISpecification = (() => {
    try {
      console.log(' -> 🔍 Validating OpenAPI specification...');
      return OpenAPISpecificationValidationSchema.parse(
        inputOpenAPISpecification
      ) as any;
    } catch (err) {
      const errorFilePath = `${debugOutputRootPath}/openapi_spec_validation.error.json`;
      ensureDirSync(debugOutputRootPath);
      console.error(
        ` -> 😞 Oops! Something went wrong while validating your OpenAPI specification. See ${errorFilePath} for details.`
      );
      writeFileSync(errorFilePath, JSON.stringify(err, null, 2));
      process.exit(1);
    }
  })();
  console.log(' -> 👍 OpenAPI specification is valid.');
  //#endregion

  //#region Initialization
  console.log('\n🚀 Generate Typescript API.');
  const clientName = validOpenAPISpecification.info.title.toTitleCase();
  const autogeneratedFileWarningComment = getGeneratedFileWarningComment();
  const scopeModelPrefix = (() => {
    if (scopeName) {
      return scopeName.toPascalCase();
    }
  })();
  //#endregion

  //#region Prefix all models and model references
  const openAPISpecification = (() => {
    if (scopeModelPrefix) {
      return prefixModelsAndModelReferences({
        openAPISpecification: validOpenAPISpecification,
        prefix: scopeModelPrefix,
      });
    }
    return validOpenAPISpecification;
  })();
  //#endregion

  //#region Find all requests and group them by tag
  console.log(` -> Grouping API requests by tag...`);
  const requestGroupings = Object.keys(
    openAPISpecification.paths
  ).reduce<RequestGroupings>((accumulator, path) => {
    Object.keys(openAPISpecification.paths[path]).forEach((method) => {
      const request = openAPISpecification.paths[path][method as RequestMethod];

      //#region Generate anonymous schemas for all responses and request bodies that are not referenced by any other schema
      const { requestBody } = request;
      const operationName = (() => {
        if (
          requestOperationNameSource === 'requestSummary' &&
          request.summary
        ) {
          return request.summary;
        }
        if (request.operationId) {
          return request.operationId.split(/\W/g).reverse()[0];
        }
        throw new Error(
          `Could not determine operation name. ${JSON.stringify(
            request,
            null,
            2
          )}`
        );
      })().trim();
      const camelCaseOperationName = operationName.toCamelCase();
      const pascalCaseOperationName = operationName.toPascalCase();
      if (requestBody) {
        const { content } = requestBody;
        if (
          content &&
          'application/json' in content &&
          content['application/json'].schema &&
          'type' in content['application/json'].schema &&
          content['application/json'].schema.type === 'object'
        ) {
          const schemaName = `${pascalCaseOperationName}RequestPayload`;
          openAPISpecification.components.schemas[schemaName] =
            content['application/json'].schema;
          content['application/json'].schema = {
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
        const typePrefix = (() => {
          const match = /^\[(.+)\]\s/g.exec(tag);
          if (match) {
            return match[1].toPascalCase();
          }
          return scopeModelPrefix || '';
        })();

        requests.push({
          ...request,
          method: method as RequestMethod,
          requestPath: path,
          operationName: camelCaseOperationName,
          pascalCaseOperationName,
          requestPathName:
            operationName.replace(/\s/g, '_').toUpperCase() + `_ENDPOINT_PATH`,
          operationDescription: (() => {
            if (
              requestOperationNameSource === 'requestSummary' &&
              request.summary
            ) {
              return request.summary;
            }
          })(),
          requestBodySchemaName: (() => {
            if (
              request.requestBody?.content &&
              'application/json' in request.requestBody.content &&
              request.requestBody.content['application/json'].schema &&
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
                content['application/json'].schema &&
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
                      requestBodyTypeDependentSchemaName: requestBodySchemaName,
                    };
                  }
                  if (
                    'type' in schema.items &&
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
          // TODO: Deal with oneof schema types
          successResponseSchemas: (() => {
            const successResponses = Object.entries(request.responses).filter(
              ([responseCode]) => responseCode.startsWith('2')
            );
            if (successResponses.length > 0) {
              return successResponses
                .filter(([, response]) => {
                  return response.content;
                })
                .map(([successResponse, response]) => {
                  const httpStatusCode = +successResponse;
                  const content = response.content!;
                  const description = response.description;
                  if (
                    'application/json' in content &&
                    content['application/json'].schema
                  ) {
                    if ('$ref' in content['application/json'].schema) {
                      const successResponseSchemaName = content[
                        'application/json'
                      ].schema.$ref.replace('#/components/schemas/', '');
                      return {
                        name: successResponseSchemaName,
                        httpStatusCode,
                        description,
                      } as SuccessResponseSchema;
                    } else if ('type' in content['application/json'].schema) {
                      const getSchemaPrimitiveSchemaType = (type: string) => {
                        switch (type) {
                          case 'boolean':
                            return 'boolean';
                          case 'integer':
                          case 'number':
                            return 'number';
                          case 'string':
                            return 'string';
                        }
                      };
                      switch (content['application/json'].schema.type) {
                        case 'boolean':
                        case 'integer':
                        case 'number':
                        case 'string':
                          return {
                            type: getSchemaPrimitiveSchemaType(
                              content['application/json'].schema.type
                            ),
                            httpStatusCode,
                            description,
                          } as SuccessResponseSchema;
                        case 'array':
                          if (content['application/json'].schema.items) {
                            if (
                              '$ref' in content['application/json'].schema.items
                            ) {
                              const schemaReference =
                                content['application/json'].schema.items.$ref;
                              const successResponseSchemaName =
                                schemaReference.replace(
                                  '#/components/schemas/',
                                  ''
                                );
                              return {
                                name: successResponseSchemaName,
                                httpStatusCode,
                                description,
                                isArray: true,
                              } as SuccessResponseSchema;
                            } else if (
                              'type' in content['application/json'].schema.items
                            ) {
                              return {
                                type: getSchemaPrimitiveSchemaType(
                                  content['application/json'].schema.items.type
                                ),
                                httpStatusCode,
                                description,
                                isArray: true,
                              } as SuccessResponseSchema;
                            }
                          }
                      }
                    }
                  }
                  if ('image/png' in content) {
                    return {
                      name: BINARY_RESPONSE_TYPE_MODEL_NAME,
                      description,
                      httpStatusCode,
                    } as SuccessResponseSchema;
                  }
                  if ('application/pdf' in content) {
                    return {
                      name: BINARY_RESPONSE_TYPE_MODEL_NAME,
                      description,
                      httpStatusCode,
                    } as SuccessResponseSchema;
                  }
                  if ('*/*' in content) {
                    return {
                      type: 'any',
                      description,
                      httpStatusCode,
                    } as SuccessResponseSchema;
                  }
                  return {
                    type: 'any',
                    description,
                    httpStatusCode,
                  } as SuccessResponseSchema;
                })
                .filter((schema) => schema) as SuccessResponseSchema[];
            }
          })(),

          //#region Path parameters
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
          //#endregion

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
                const headerParametersModelReference = `${typePrefix}${pascalCaseOperationName}HeaderParams`;
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
                const queryParametersModelReference = `${typePrefix}${pascalCaseOperationName}QueryParams`;
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
  }, {});
  //#endregion

  //#region Group request tag groups by scope
  console.log(` -> Grouping request tag groups by scope...`);
  const requestTagGroupsByScope = Object.entries(
    requestGroupings
  ).reduce<RequestScopeGroupings>((accumulator, [tag, requestGrouping]) => {
    const match = /^\[(.+)\]\s/g.exec(tag);
    const scopeName = match ? match[1] : 'Root';
    if (!accumulator[scopeName]) {
      accumulator[scopeName] = {};
    }
    accumulator[scopeName][tag.replace(/^\[(.+)\]\s*/g, '').trim()] =
      requestGrouping;
    return accumulator;
  }, {});
  //#endregion

  //#region Generate scoped code
  const scopedCode = Object.entries(requestTagGroupsByScope).reduce<{
    [scopeName: string]: {
      tagToEntityLabelMappings: TagNameToEntityLabelsMap;
      modelMappings: ModelMappings;
      apiFunctionsCodeConfiguration: APIFunctionsCodeConfiguration;
      tsedControllersCodeConfiguration?: TSEDControllersCodeConfiguration;
      requestGroupings: RequestGroupings;
    };
  }>((accumulator, [localScopeName, requestGroupings]) => {
    //#region Generate tag to entity mappings
    console.log(` -> Generating tag to entity mappings...`);
    const tagToEntityLabelMappings = [
      ...Object.keys(requestGroupings),
      'Utils',
    ].reduce<TagNameToEntityLabelsMap>((accumulator, tag) => {
      const labelPlural = tag;
      const labelSingular = pluralize.singular(tag);
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
    }, {});
    //#endregion

    //#region Generate model mappings.
    console.log(` -> Generating model mappings...`);
    const modelMappings = generateModelMappings({
      requestGroupings,
      openAPISpecification: openAPISpecification,
      generateTsEDControllers,
      inferTypeFromValidationSchema,
    });

    const { schemaToEntityMappings, modelsToValidationSchemaMappings } =
      modelMappings;
    //#endregion

    //#region Generate API functions code configuration
    console.log(` -> Generating API functions code configuration...`);
    const apiFunctionsCodeConfiguration = getAPIFunctionsCodeConfiguration({
      requestGroupings,
      modelsToValidationSchemaMappings,
      schemaToEntityMappings,
      tagToEntityLabelMappings,
      localScopeName,
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
          tsedControllerNamePrefix: (() => {
            if (scopeName) {
              return `[${scopeName}] `;
            }
            return tsedControllerNamePrefix;
          })(),
          tsedControllerNameSuffix,
          openAPISpecification,
        });
      }
    })();
    //#endregion

    accumulator[localScopeName] = {
      tagToEntityLabelMappings,
      modelMappings,
      apiFunctionsCodeConfiguration,
      tsedControllersCodeConfiguration,
      requestGroupings,
    };

    return accumulator;
  }, {});
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
    cleanEmptyFoldersRecursively(outputRootPath);
  }
  //#endregion

  //#region Write debug output files
  if (outputInternalState) {
    console.log(` -> Writing debug output files...`);
    ensureDirSync(debugOutputRootPath);
    writeFileSync(
      `${debugOutputRootPath}/api_request_grouped_by_tag.debug.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${debugOutputRootPath}/api_request_groups_grouped_by_scope.debug.json`,
      JSON.stringify(requestTagGroupsByScope, null, 2)
    );
  }
  //#endregion

  //#region Write scoped files
  Object.entries(scopedCode).forEach(([scopeName, scopedCodeConfiguration]) => {
    const {
      apiFunctionsCodeConfiguration,
      modelMappings,
      tagToEntityLabelMappings,
      tsedControllersCodeConfiguration,
      requestGroupings,
    } = scopedCodeConfiguration;

    const {
      models,
      schemaEntityReferences,
      schemaToEntityMappings,
      entitySchemaGroups,
      modelsToValidationSchemaMappings,
    } = modelMappings;

    //#region Write debug output files
    if (outputInternalState) {
      const scopedDebugOutputRootPath = `${debugOutputRootPath}/${scopeName}`;
      ensureDirSync(scopedDebugOutputRootPath);
      writeFileSync(
        `${scopedDebugOutputRootPath}/tag_to_entity_mappings.debug.json`,
        JSON.stringify(tagToEntityLabelMappings, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/schema_references.debug.json`,
        JSON.stringify(schemaEntityReferences, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/schema_to_entity_mappings.debug.json`,
        JSON.stringify(schemaToEntityMappings, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/schemas_grouped_by_tag.debug.json`,
        JSON.stringify(entitySchemaGroups, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/validation_schemas.debug.json`,
        JSON.stringify(models, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/models_to_validation_schema_mappings.debug.json`,
        JSON.stringify(modelsToValidationSchemaMappings, null, 2)
      );
      writeFileSync(
        `${scopedDebugOutputRootPath}/api_functions_code_configuration.debug.json`,
        JSON.stringify(apiFunctionsCodeConfiguration, null, 2)
      );
    }
    //#endregion

    const pascalCaseScopeName = scopeName.toPascalCase();
    const isRootScope = pascalCaseScopeName === 'Root';
    const scopedOutputRootPath = isRootScope
      ? outputRootPath
      : `${outputRootPath}/proxies/${pascalCaseScopeName}`;

    //#region Write model files
    console.log(` -> Writing model files...`);
    const modelsOutputFilePath = `${scopedOutputRootPath}/models`;
    ensureDirSync(modelsOutputFilePath);
    Object.keys(models).forEach((tag) => {
      const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
      const modelFileName = `${PascalCaseEntities}.ts`;
      const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;
      if (!existsSync(entityModelsOutputFilePath)) {
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
      }
    });

    const modelsIndexOutputFilePath = `${modelsOutputFilePath}/index.ts`;
    if (!existsSync(modelsIndexOutputFilePath)) {
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
    }
    //#endregion

    //#region Write API files
    console.log(` -> Writing API files...`);
    const apiOutputFilePath = `${scopedOutputRootPath}/api`;
    ensureDirSync(apiOutputFilePath);
    Object.keys(apiFunctionsCodeConfiguration).forEach((tag) => {
      const { PascalCaseEntities } = tagToEntityLabelMappings[tag];
      const apiFileName = `${PascalCaseEntities}.ts`;

      const entityAPIOutputFilePath = `${apiOutputFilePath}/${apiFileName}`;
      if (!existsSync(entityAPIOutputFilePath)) {
        const {
          outputCode,
          requestPathsOutputCode,
          imports,
          dataKeyVariableName,
        } = apiFunctionsCodeConfiguration[tag];
        if (!isRootScope) {
          const adapterImports = imports['./Adapter'];
          imports['../../../api/Adapter'] = adapterImports;
          delete imports['./Adapter'];
        }
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
            export const ${dataKeyVariableName} = '${
                scopeName !== 'Root' ? scopeName.toPascalCase() : ''
              }${tagToEntityLabelMappings[tag].PascalCaseEntities}';
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
      }
    });

    if (isRootScope) {
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
    }

    const apiIndexOutputFilePath = `${apiOutputFilePath}/index.ts`;
    const exportableFileNames = Object.keys(requestGroupings).map((tag) => {
      return tagToEntityLabelMappings[tag].PascalCaseEntities;
    });

    if (isRootScope) {
      exportableFileNames.push('Adapter');
    }

    if (!existsSync(apiIndexOutputFilePath)) {
      writeFileSync(
        apiIndexOutputFilePath,
        prettier.format(
          `${autogeneratedFileWarningComment}\n\n` +
            exportableFileNames
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
    }
    //#endregion

    //#region Write TSED controller files
    if (generateTsEDControllers && tsedControllersCodeConfiguration) {
      console.log(` -> Writing TSED controller files...`);
      const tsedControllersOutputFilePath = `${scopedOutputRootPath}/controllers`;
      ensureDirSync(tsedControllersOutputFilePath);
      Object.keys(tsedControllersCodeConfiguration).forEach((tag) => {
        const { PascalCaseEntity } = tagToEntityLabelMappings[tag];
        const controllerFileName = `${PascalCaseEntity}Controller.ts`;
        const controllerOutputFilePath = `${tsedControllersOutputFilePath}/${controllerFileName}`;

        if (!existsSync(controllerOutputFilePath)) {
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
        }
      });

      const tsedControllersIndexOutputFilePath = `${tsedControllersOutputFilePath}/index.ts`;
      if (!existsSync(tsedControllersIndexOutputFilePath)) {
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
    }
    //#endregion

    //#region Write index file
    if (!isRootScope) {
      console.log(` -> Writing ${scopeName} index file...`);
      const indexOutputFilePath = `${scopedOutputRootPath}/index.ts`;
      if (!existsSync(indexOutputFilePath)) {
        const apiFunctionsCode = Object.values(apiFunctionsCodeConfiguration)
          .reduce((accumulator, { exports }) => {
            accumulator.push(...exports);
            return accumulator;
          }, [] as string[])
          .join(',\n');
        const indexOutputCode = [
          `${autogeneratedFileWarningComment}`,
          `import {${apiFunctionsCode}} from './api';`,
          `
          export const ${pascalCaseScopeName} = {
            ${apiFunctionsCode}
          };
        `.trimIndent(),
        ];
        writeFileSync(
          indexOutputFilePath,
          prettier.format(indexOutputCode.join('\n\n'), {
            filepath: indexOutputFilePath,
            ...prettierConfig,
          })
        );
      }
    }
    //#endregion
  });
  //#endregion

  //#region Write proxies index file
  const nonRootScopes = Object.keys(scopedCode)
    .filter((scopeName) => {
      return scopeName !== 'Root';
    })
    .map((scopeName) => {
      return scopeName.toPascalCase();
    });
  if (nonRootScopes.length > 0) {
    const proxiesIndexOutputFilePath = `${outputRootPath}/proxies/index.ts`;
    if (!existsSync(proxiesIndexOutputFilePath)) {
      writeFileSync(
        proxiesIndexOutputFilePath,
        prettier.format(
          `${autogeneratedFileWarningComment}\n\n` +
            nonRootScopes
              .map((PascalCaseScopeName) => {
                return `export * from './${PascalCaseScopeName}';`;
              })
              .join('\n'),
          {
            filepath: proxiesIndexOutputFilePath,
            ...prettierConfig,
          }
        )
      );
    }
  }
  //#endregion

  //#region Write index file
  console.log(`\n🏁 Finish`);
  console.log(` -> Writing index file...`);
  const indexOutputFilePath = `${outputRootPath}/index.ts`;
  if (!existsSync(indexOutputFilePath)) {
    writeFileSync(
      indexOutputFilePath,
      prettier.format(
        `${autogeneratedFileWarningComment}\n\n` +
          ['api', 'models', 'proxies', 'controllers']
            .filter((folderName) => {
              return existsSync(`${outputRootPath}/${folderName}`);
            })
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
