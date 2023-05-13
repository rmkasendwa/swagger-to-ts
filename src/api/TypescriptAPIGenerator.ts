import '@infinite-debugger/rmk-js-extensions/String';

import { ensureDirSync, writeFileSync } from 'fs-extra';
import prettier from 'prettier';

import { OpenAPISpecification } from '../models';
import { RequestMethod } from '../models/OpenAPISpecification/Request';
import { prettierConfig } from '../models/Prettier';
import {
  PATHS_LIBRARY,
  RequestGroupings,
} from '../models/TypescriptAPIGenerator';
import { generateModelMappings } from './ModelCodeGenerator';

export const API_ADAPTER_PATH = `./Adapter`;

export interface GenerateTypescriptAPIConfig {
  swaggerDocs: OpenAPISpecification;
  outputRootPath: string;
  outputInternalState?: boolean;
  requestOperationNameSource?: 'requestSummary' | 'requestOperationId';
}

export const generateTypescriptAPI = async ({
  swaggerDocs,
  outputRootPath,
  outputInternalState = false,
  requestOperationNameSource: requestOperationName = 'requestSummary',
}: GenerateTypescriptAPIConfig) => {
  //#region Find all requests and group them by tag
  const requestGroupings = Object.keys(swaggerDocs.paths).reduce(
    (accumulator, path) => {
      Object.keys(swaggerDocs.paths[path]).forEach((method) => {
        const request = swaggerDocs.paths[path][method as RequestMethod];
        request.tags.forEach((tag) => {
          if (!accumulator[tag]) {
            accumulator[tag] = {
              imports: {},
              requests: [],
            };
          }
          if (!accumulator[tag].imports[API_ADAPTER_PATH]) {
            accumulator[tag].imports[API_ADAPTER_PATH] = [];
          }
          if (!accumulator[tag].imports[API_ADAPTER_PATH].includes(method)) {
            accumulator[tag].imports[API_ADAPTER_PATH].push(method);
          }

          accumulator[tag].requests.push({
            ...request,
            method: method as RequestMethod,
            endpointPath: path,
            operationName: (() => {
              if (
                requestOperationName === 'requestSummary' &&
                request.summary
              ) {
                return request.summary.toCamelCase();
              }
              return request.operationId;
            })(),
            endpointPathName:
              (() => {
                if (
                  requestOperationName === 'requestSummary' &&
                  request.summary
                ) {
                  return request.summary.replace(/\s/g, '_').toUpperCase();
                }
                return request.operationId.replace(/\s/g, '_').toUpperCase();
              })() + `_ENDPOINT_PATH`,
            ...(() => {
              if (request.parameters) {
                const pathParameters = request.parameters.filter(
                  (parameter) => parameter.in === 'path'
                );
                if (pathParameters.length > 0) {
                  const pathParamType = `TemplatePath`;
                  if (!accumulator[tag].imports[PATHS_LIBRARY]) {
                    accumulator[tag].imports[PATHS_LIBRARY] = [];
                  }
                  if (
                    !accumulator[tag].imports[PATHS_LIBRARY].includes(
                      pathParamType
                    )
                  ) {
                    accumulator[tag].imports[PATHS_LIBRARY].push(pathParamType);
                  }
                  return {
                    pathParameters,
                  };
                }
              }
            })(),
            operationDescription: (() => {
              if (
                requestOperationName === 'requestSummary' &&
                request.summary
              ) {
                const [verb, ...restSummary] = request.summary.split(' ');
                return (
                  verb.replace(/[ei]+$/g, '') + 'ing ' + restSummary.join(' ')
                );
              }
            })(),
          });
        });
      });
      return accumulator;
    },
    {} as RequestGroupings
  );
  //#endregion

  const {
    entitySchemaGroups,
    schemaEntityMappings,
    schemaEntityReferences,
    models,
  } = generateModelMappings({
    requestGroupings,
    swaggerDocs,
  });

  //#region Write model output files
  const modelsOutputFilePath = `${outputRootPath}/models`;
  ensureDirSync(modelsOutputFilePath);
  Object.keys(models).forEach((entityName) => {
    const pascalCaseEntityName = entityName.toPascalCase();
    const modelFileName = `${pascalCaseEntityName}.ts`;
    const entityModelsOutputFilePath = `${modelsOutputFilePath}/${modelFileName}`;

    const entityModelsOutputCode = Object.values(models[entityName].models)
      .sort(
        (
          { referencedSchemas: aReferencedSchemas, name: aName },
          { referencedSchemas: bReferencedSchemas, name: bName }
        ) => {
          if (aReferencedSchemas && !bReferencedSchemas) {
            return 1;
          }
          if (!aReferencedSchemas && bReferencedSchemas) {
            return -1;
          }
          if (aReferencedSchemas && bReferencedSchemas) {
            if (aReferencedSchemas.includes(bName)) {
              return 1;
            }
            if (bReferencedSchemas.includes(aName)) {
              return -1;
            }
          }
          return 0;
        }
      )
      .map((model) => model.zodValidationSchemaCode)
      .join('\n\n');

    writeFileSync(
      entityModelsOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports: models[entityName].imports,
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
        .map((entityName) => {
          return `export * from './${entityName.toPascalCase()}';`;
        })
        .join('\n'),
      {
        filepath: modelsIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

  //#region Write api output files
  const apiOutputFilePath = `${outputRootPath}/api`;
  ensureDirSync(apiOutputFilePath);
  Object.keys(requestGroupings).forEach((entityName) => {
    const pascalCaseEntityName = entityName.toPascalCase();
    const apiFileName = `${pascalCaseEntityName}.ts`;
    const entityAPIOutputFilePath = `${apiOutputFilePath}/${apiFileName}`;

    const entityAPIEndpointPathsOutputCode = requestGroupings[
      entityName
    ].requests
      .map(({ endpointPath, endpointPathName, pathParameters }) => {
        if (pathParameters && pathParameters.length > 0) {
          const parametersCode = pathParameters
            .reduce((accumulator, { name }) => {
              accumulator.push(`${name}: string`);
              return accumulator;
            }, [] as string[])
            .join(';\n');
          return `export const ${endpointPathName}: TemplatePath<{${parametersCode}}> = '${endpointPath}';`;
        }
        return `export const ${endpointPathName} = '${endpointPath}';`;
      })
      .join('\n');

    const entityAPIOutputCode = requestGroupings[entityName].requests
      .map(
        ({ method, operationName, endpointPathName, operationDescription }) => {
          return `
          export const ${operationName} = async () => {
            const { data } = await ${method}(${endpointPathName}, {
              label: '${operationDescription}',
            });
            return data;
          };
        `.trimIndent();
        }
      )
      .join('\n\n');

    writeFileSync(
      entityAPIOutputFilePath,
      prettier.format(
        [
          ...getImportsCode({
            imports: requestGroupings[entityName].imports,
          }),
          `
            //#region Endpoint Paths
            ${entityAPIEndpointPathsOutputCode}
            //#endregion
          `.trimIndent(),
          `
            //#region Data Keys
            export const ${entityName
              .replace(/\s/g, '_')
              .toUpperCase()}_DATA_KEY = '${entityName.toCamelCase()}';
            //#endregion
          `.trimIndent(),
          `
            //#region API
            ${entityAPIOutputCode}
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
    prettier.format(
      `
        import { getAPIAdapter } from '@infinite-debugger/axios-api-adapter';

        declare module '@infinite-debugger/axios-api-adapter' {
          interface IAPIAdapterConfiguration {
            API_KEY?: string;
          }
        }

        export {
          IAPIAdapterConfiguration,
          REDIRECTION_ERROR_MESSAGES,
          RequestOptions,
          ResponseProcessor,
        } from '@infinite-debugger/axios-api-adapter';
        export {
          APIAdapterConfiguration,
          RequestController,
          _delete,
          defaultRequestHeaders,
          get,
          logout,
          patch,
          patchDefaultRequestHeaders,
          post,
          put,
        };

        const {
          APIAdapterConfiguration,
          RequestController,
          _delete,
          defaultRequestHeaders,
          get,
          logout,
          patch,
          patchDefaultRequestHeaders,
          post,
          put,
        } = getAPIAdapter({
          id: 'api-client',
        });

      `.trimIndent(),
      {
        filepath: apiAdapterOutputFilePath,
        ...prettierConfig,
      }
    )
  );

  const apiIndexOutputFilePath = `${apiOutputFilePath}/index.ts`;
  writeFileSync(
    apiIndexOutputFilePath,
    prettier.format(
      [...Object.keys(requestGroupings), 'Adapter']
        .map((entityName) => {
          return `export * from './${entityName.toPascalCase()}';`;
        })
        .join('\n'),
      {
        filepath: apiIndexOutputFilePath,
        ...prettierConfig,
      }
    )
  );
  //#endregion

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

  if (outputInternalState) {
    ensureDirSync(outputRootPath);
    writeFileSync(
      `${outputRootPath}/request-groupings.output.json`,
      JSON.stringify(requestGroupings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-references.output.json`,
      JSON.stringify(schemaEntityReferences, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-to-entity-mappings.output.json`,
      JSON.stringify(schemaEntityMappings, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/schema-groupings.output.json`,
      JSON.stringify(entitySchemaGroups, null, 2)
    );
    writeFileSync(
      `${outputRootPath}/validation-schemas.output.json`,
      JSON.stringify(models, null, 2)
    );
  }
};

export interface GetImportsCodeOptions {
  imports?: Record<string, string[]>;
}
export const getImportsCode = ({ imports }: GetImportsCodeOptions) => {
  if (imports) {
    return Object.keys(imports!).map((importFilePath) => {
      const importNames = imports![importFilePath];
      return `import { ${importNames.join(', ')} } from '${importFilePath}';`;
    });
  }
  return [];
};
