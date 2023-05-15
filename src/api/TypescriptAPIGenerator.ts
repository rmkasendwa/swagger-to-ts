import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';
import prettier from 'prettier';

import {
  OpenAPISpecification,
  OpenAPISpecificationValidationSchema,
} from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  BINARY_RESPONSE_TYPE_MODEL_NAME,
  PATHS_LIBRARY_PATH,
  RequestGroupings,
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
import { addModuleImport, getImportsCode } from './Utils';

export interface GenerateTypescriptAPIConfig
  extends Pick<GenerateModelMappingsOptions, 'inferTypeFromValidationSchema'> {
  openAPISpecification: OpenAPISpecification;
  outputRootPath: string;
  outputInternalState?: boolean;
  requestOperationNameSource?: 'requestSummary' | 'requestOperationId';
  generateTsedControllers?: boolean;
}

export const generateTypescriptAPI = async ({
  openAPISpecification: inputOpenAPISpecification,
  outputRootPath,
  outputInternalState = false,
  generateTsedControllers = false,
  requestOperationNameSource = 'requestSummary',
  inferTypeFromValidationSchema,
}: GenerateTypescriptAPIConfig) => {
  console.log('Validating OpenAPI specification...');
  const openAPISpecification = (() => {
    try {
      return OpenAPISpecificationValidationSchema.parse(
        inputOpenAPISpecification
      );
    } catch (err) {
      const errorFilePath = `${process.cwd()}/openapi-spec-validation.error.json`;
      console.error(
        `OpenAPI specification validation failed. See ${errorFilePath} for details.`
      );
      writeFileSync(errorFilePath, JSON.stringify(err, null, 2));
      process.exit(1);
    }
  })();
  console.log(' -> 👍 OpenAPI specification validated.');
  console.log('Generating API...');

  const clientName = openAPISpecification.info.title.toTitleCase();

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
          return request.operationId;
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

          const { imports, requests } = accumulator[tag];

          requests.push({
            ...request,
            method: method as RequestMethod,
            endpointPath: path,
            operationName,
            pascalCaseOperationName,
            endpointPathName:
              (() => {
                if (
                  requestOperationNameSource === 'requestSummary' &&
                  request.summary
                ) {
                  return request.summary.replace(/\s/g, '_').toUpperCase();
                }
                return request.operationId.replace(/\s/g, '_').toUpperCase();
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
            successResponseSchemaName: (() => {
              const successResponse = Object.keys(request.responses).find(
                (responseCode) => responseCode.startsWith('2')
              );
              if (
                successResponse &&
                request.responses[successResponse].content
              ) {
                if (
                  'application/json' in
                  request.responses[successResponse].content!
                ) {
                  const successResponseSchemaName = (
                    request.responses[successResponse] as any
                  ).content['application/json'].schema.$ref.replace(
                    '#/components/schemas/',
                    ''
                  );
                  return successResponseSchemaName;
                }
                if (
                  'image/png' in request.responses[successResponse].content!
                ) {
                  return BINARY_RESPONSE_TYPE_MODEL_NAME;
                }
              }
            })(),
            ...(() => {
              if (request.parameters) {
                const pathParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'path'
                );
                if (pathParameters.length > 0) {
                  const pathParamType = `TemplatePath`;
                  addModuleImport({
                    imports,
                    importName: pathParamType,
                    importFilePath: PATHS_LIBRARY_PATH,
                  });
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
    openAPISpecification,
    generateTsedControllers,
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

  //#region Write debug output files
  if (outputInternalState) {
    console.log(` -> Writing debug output files...`);
    ensureDirSync(outputRootPath);
    writeFileSync(
      `${outputRootPath}/request-groupings.output.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/tag-entity-label-mappings.output.json`,
      JSON.stringify(tagToEntityLabelMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-references.output.json`,
      JSON.stringify(schemaEntityReferences, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-to-entity-mappings.output.json`,
      JSON.stringify(schemaToEntityMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-groupings.output.json`,
      JSON.stringify(entitySchemaGroups, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/validation-schemas.output.json`,
      JSON.stringify(models, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/models-to-validation-schema-mappings.output.json`,
      JSON.stringify(modelsToValidationSchemaMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/api-functions-code-configuration.output.json`,
      JSON.stringify(apiFunctionsCodeConfiguration, null, 2)
    );
  }
  //#endregion

  //#region Write API model files
  console.log(` -> Writing API model files...`);
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
    const {
      apiOutputCode,
      endpointPathsOutputCode,
      imports,
      dataKeyVariableName,
    } = apiFunctionsCodeConfiguration[tag];

    writeFileSync(
      entityAPIOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports,
          }),
          `
            //#region Endpoint Paths
            ${endpointPathsOutputCode}
            //#endregion
          `.trimIndent(),
          `
            //#region Data Keys
            export const ${dataKeyVariableName} = '${tagToEntityLabelMappings[tag].PascalCaseEntities}';
            //#endregion
          `.trimIndent(),
          `
            //#region API
            ${apiOutputCode}
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
  writeFileSync(
    apiAdapterOutputFilePath,
    prettier.format(getAPIAdapterCode(), {
      filepath: apiAdapterOutputFilePath,
      ...prettierConfig,
    })
  );

  const apiIndexOutputFilePath = `${apiOutputFilePath}/index.ts`;
  writeFileSync(
    apiIndexOutputFilePath,
    prettier.format(
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

  //#region Write index file
  console.log(` -> Writing index file...`);
  const indexOutputFilePath = `${outputRootPath}/index.ts`;
  writeFileSync(
    indexOutputFilePath,
    prettier.format(
      ['api', 'models']
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
  //#endregion

  console.log(`Process Completed Successfully`);
  console.log(
    ` -> ✅ Generated ${clientName} typescript client code at ${outputRootPath}`
  );
};
