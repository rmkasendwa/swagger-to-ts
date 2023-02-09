import '@infinite-debugger/rmk-js-extensions/String';

import { dirname } from 'path';

import { OS3Parameter, OS3Paths, OpenSpec3 } from '@tsed/openspec';
import { ensureDirSync, existsSync, writeFileSync } from 'fs-extra';
import { pick } from 'lodash';
import prettier from 'prettier';

import {
  getInterfaceProperties,
  getInterfacePropertyType,
} from './TypescriptInterfaceGenerator';

type Parameter = {
  name: string;
  description?: string;
  required?: boolean;
  type: string;
  schema: any;
};

interface APIAction {
  name: string;
  endpointPathIdentifierString: string;
  enpointPathString: string;
  snippet: string;
}

interface APIEntity {
  entityNamePascalCase: string;
  entityNameUpperCase: string;
  entityNameCamelCase: string;
  apiModuleImports: Record<string, string[]>;
  actions: APIAction[];
  endpointPaths: Record<string, string>;
  interfaceSnippets: Record<string, string>;
}

const prettierConfig: prettier.Options = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  endOfLine: 'auto',
};

const ouputSubFolders = [
  'api',
  'data-keys',
  'endpoint-paths',
  'interfaces',
] as const;

const PATHS_LIB = `@infinite-debugger/rmk-utils/paths`;
const API_ADAPTER_PATH = `./Adapter`;
const interfacesFileLocationRelativetoAPI = `../interfaces`;

export interface GenerateTypescriptAPIConfig {
  swaggerDocs: OpenSpec3;
  outputRootPath: string;
}

export const generateTypescriptAPI = async ({
  swaggerDocs,
  outputRootPath,
}: GenerateTypescriptAPIConfig) => {
  // Cumulatively finding entites
  const entities = Object.keys(swaggerDocs.paths).reduce(
    (accumulator, pathKey: keyof typeof swaggerDocs.paths) => {
      const swaggerDocsPath = swaggerDocs.paths[pathKey];
      Object.keys(swaggerDocsPath).forEach((key) => {
        const httpVerb = key as keyof typeof swaggerDocsPath;
        const {
          summary,
          description,
          responses,
          tags,
          parameters = [],
          requestBody,
        } = {
          ...(swaggerDocsPath[httpVerb] as any),
        } as OS3Paths & {
          tags: string[];
          responses: any;
          requestBody: any;
        };

        if (tags && tags.length > 0 && summary) {
          const entityGroupName = tags[0];
          const entityNameCamelCase = entityGroupName.toCamelCase();
          const entityNamePascalCase = entityGroupName.toPascalCase();
          const entityNameUpperCase = entityGroupName
            .replace(/\s+/g, '_')
            .toUpperCase();
          if (!accumulator[entityGroupName]) {
            accumulator[entityGroupName] = {
              entityNameCamelCase,
              entityNamePascalCase,
              entityNameUpperCase,
              actions: [],
              apiModuleImports: {},
              endpointPaths: {},
              interfaceSnippets: {},
            };
          }

          const endpointPathsFileLocationRelativetoAPI = `../endpoint-paths/${entityNamePascalCase}`;

          const name = summary.toCamelCase();
          const pascalCaseActionName = summary.toPascalCase();

          const endpointPathIdentifierString = `${summary
            .replace(/\s+/g, '_')
            .toUpperCase()}_ENDPOINT_PATH`;
          const enpointPathString = pathKey.replace(/\{(\w+)\}/g, ':$1');

          accumulator[entityGroupName].endpointPaths[
            endpointPathIdentifierString
          ] = enpointPathString;

          // Resolving endpoint paths imports
          if (
            !accumulator[entityGroupName].apiModuleImports[
              endpointPathsFileLocationRelativetoAPI
            ]
          ) {
            accumulator[entityGroupName].apiModuleImports[
              endpointPathsFileLocationRelativetoAPI
            ] = [];
          }
          if (
            !accumulator[entityGroupName].apiModuleImports[
              endpointPathsFileLocationRelativetoAPI
            ].includes(endpointPathIdentifierString)
          ) {
            accumulator[entityGroupName].apiModuleImports[
              endpointPathsFileLocationRelativetoAPI
            ].push(endpointPathIdentifierString);
          }

          const [verb, ...restSummary] = summary.split(' ');
          const actionDescription =
            verb.replace(/[ei]+$/g, '') + 'ing ' + restSummary.join(' ');

          const pathParams = parameters
            .filter((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return parameter.in && parameter.in === 'path';
            })
            .map((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return {
                ...pick(parameter, 'name', 'description'),
                type: (parameter.schema as any).type, // TODO: Deal with complex types
              } as Parameter;
            });

          const httpActionString = (() => {
            if (httpVerb.match(/delete/gi)) {
              return `_${httpVerb}`;
            }
            return httpVerb;
          })();

          if (
            !accumulator[entityGroupName].apiModuleImports[API_ADAPTER_PATH]
          ) {
            accumulator[entityGroupName].apiModuleImports[API_ADAPTER_PATH] =
              [];
          }
          if (
            !accumulator[entityGroupName].apiModuleImports[
              API_ADAPTER_PATH
            ].includes(httpActionString)
          ) {
            accumulator[entityGroupName].apiModuleImports[
              API_ADAPTER_PATH
            ].push(httpActionString);
          }

          const requestOptionsTypeString = `RequestOptions`;
          if (
            !accumulator[entityGroupName].apiModuleImports[
              API_ADAPTER_PATH
            ].includes(requestOptionsTypeString)
          ) {
            accumulator[entityGroupName].apiModuleImports[
              API_ADAPTER_PATH
            ].push(requestOptionsTypeString);
          }

          // API Return type
          const apiReturnType = (() => {
            const successfulResponse = Object.keys(responses)
              .filter((key) => {
                return key.match(/^[23]\d\d$/g);
              })
              .map((key) => {
                return responses[key] as {
                  description: string;
                  content?: {
                    [k: string]: {
                      schema: {
                        $ref?: string;
                        type?: string;
                      };
                    };
                  };
                };
              })[0];
            if (successfulResponse) {
              return successfulResponse;
            }
          })();

          const apiReturnTypeInterfaceName = (() => {
            if (apiReturnType && apiReturnType.content) {
              const [returnContentType] = Object.keys(apiReturnType.content);
              const baseModelRefPath =
                apiReturnType.content[returnContentType].schema.$ref;
              if (baseModelRefPath) {
                const apiReturnTypeInterfaceName = baseModelRefPath
                  .split('/')
                  .slice(-1)[0];

                if (
                  !accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ]
                ) {
                  accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ] = [];
                }
                if (
                  !accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ].includes(apiReturnTypeInterfaceName)
                ) {
                  accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ].push(apiReturnTypeInterfaceName);
                }

                return apiReturnTypeInterfaceName;
              } else if (apiReturnType.content[returnContentType].schema.type) {
                return apiReturnType.content[returnContentType].schema.type;
              }
            } else {
              // console.log({ apiReturnType, swaggerDocsPath });
            }
          })();

          const apiRequestBodyTypeInterfaceName = (() => {
            if (requestBody && requestBody.content) {
              const [requestContentType] = Object.keys(requestBody.content);
              const baseModelRefPath =
                requestBody.content[requestContentType].schema.$ref;
              if (baseModelRefPath) {
                const apiRequestBodyTypeInterfaceName = baseModelRefPath
                  .split('/')
                  .slice(-1)[0];

                if (
                  !accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ]
                ) {
                  accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ] = [];
                }
                if (
                  !accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ].includes(apiRequestBodyTypeInterfaceName)
                ) {
                  accumulator[entityGroupName].apiModuleImports[
                    interfacesFileLocationRelativetoAPI
                  ].push(apiRequestBodyTypeInterfaceName);
                }

                return apiRequestBodyTypeInterfaceName;
              } else if (requestBody.content[requestContentType].schema.type) {
                if (
                  requestBody.content[requestContentType].schema.type ===
                  'array'
                ) {
                  if (
                    requestBody.content[requestContentType].schema.items?.$ref
                  ) {
                    const pathLevels =
                      requestBody.content[
                        requestContentType
                      ].schema.items.$ref.split('/');
                    const apiRequestBodyTypeInterfaceName =
                      pathLevels[pathLevels.length - 1];
                    return `${apiRequestBodyTypeInterfaceName}[]`;
                  }
                  if (
                    requestBody.content[requestContentType].schema.items?.type
                  ) {
                    return `${requestBody.content[requestContentType].schema.items.type}[]`;
                  }
                  return 'any[]';
                }
                return requestBody.content[requestContentType].schema.type;
              }
            } else {
              // console.log({ apiReturnType, swaggerDocsPath });
            }
          })();

          const queryParams = parameters
            .filter((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return parameter.in && parameter.in === 'query';
            })
            .map((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return {
                ...pick(parameter, 'name', 'description', 'required', 'schema'),
                type: (parameter.schema as any).type, // TODO: Deal with complex types
              } as Parameter;
            });

          if (queryParams.length > 0) {
            const interfaceName = `${pascalCaseActionName}QueryParams`;
            const queryParamPropertiesString = queryParams
              .map(({ name, schema }) => {
                const interfaceType = getInterfacePropertyType(
                  schema,
                  swaggerDocs
                );
                // TODO: Add examples and defaults in jsdoc comment
                return `'${name}'?: ${interfaceType};`;
              })
              .join('\n');

            if (
              !accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ]
            ) {
              accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ] = [];
            }
            if (
              !accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ].includes(interfaceName)
            ) {
              accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ].push(interfaceName);
            }

            if (
              !accumulator[entityGroupName].interfaceSnippets[interfaceName]
            ) {
              accumulator[entityGroupName].interfaceSnippets[interfaceName] = `
                export type ${interfaceName} = {
                  ${queryParamPropertiesString}
                }
              `;
            }
          }

          const headerParams = parameters
            .filter((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return (
                parameter.in &&
                parameter.in === 'header' &&
                !parameter.name.match(/authorization/gi)
              );
            })
            .map((baseParameter) => {
              const parameter = baseParameter as OS3Parameter;
              return {
                ...pick(parameter, 'name', 'description', 'required'),
                type: (parameter.schema as any).type, // TODO: Deal with complex types
              } as Parameter;
            });

          if (headerParams.length > 0) {
            const interfaceName = `${pascalCaseActionName}Headers`;
            const headerParamPropertiesString = headerParams
              .map(({ name, type, required }) => {
                const interfaceType = (() => {
                  if (['number', 'string'].includes(type)) {
                    return type;
                  }
                  return 'string';
                })();
                // TODO: Add examples and defaults in jsdoc comment
                return `'${name}'${!required ? '?' : ''}: ${interfaceType};`;
              })
              .join('\n');

            if (
              !accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ]
            ) {
              accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ] = [];
            }
            if (
              !accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ].includes(interfaceName)
            ) {
              accumulator[entityGroupName].apiModuleImports[
                interfacesFileLocationRelativetoAPI
              ].push(interfaceName);
            }

            if (
              !accumulator[entityGroupName].interfaceSnippets[interfaceName]
            ) {
              accumulator[entityGroupName].interfaceSnippets[interfaceName] = `
                export type ${interfaceName} = {
                  ${headerParamPropertiesString}
                }
              `;
            }
          }

          const { paramsString, jsDocCommentSnippet } = (() => {
            const lines: string[] = [];
            if (description) {
              lines.push(description, '');
            }
            if (pathParams.length > 0) {
              lines.push(
                ...pathParams.map(({ name, description }) => {
                  return `@param ${name} ${description}`.trim();
                })
              );
            }

            const paramsString = [
              ...pathParams.map(({ name, type }) => {
                return `${name}: ${type}`;
              }),
              ...(() => {
                if (apiRequestBodyTypeInterfaceName) {
                  lines.push(
                    `@param requestPayload ${
                      requestBody.description || ''
                    }`.trim()
                  );
                  return [`requestPayload: ${apiRequestBodyTypeInterfaceName}`];
                }
                return [];
              })(),
              ...(() => {
                if (headerParams.length > 0) {
                  lines.push(`@param headers`);
                  return [`headers: ${pascalCaseActionName}Headers`];
                }
                return [];
              })(),
              ...(() => {
                if (queryParams.length > 0) {
                  lines.push(`@param queryParams`);
                  return [
                    `queryParams: ${pascalCaseActionName}QueryParams = {}`,
                  ];
                }
                return [];
              })(),
              `{ ...rest }: RequestOptions = {}`,
            ].join(', ');

            if (apiReturnType) {
              lines.push(`@returns ${apiReturnType.description}`);
            }

            return {
              paramsString,
              jsDocCommentSnippet: (() => {
                if (lines.length > 0) {
                  const linesString = lines
                    .map((line) => {
                      return ` * ${line}`;
                    })
                    .join('\n');
                  return `
                    /**
                     ${linesString}
                    */
                  `
                    .trimIndent()
                    .trim();
                }
                return '';
              })(),
            };
          })();

          const interpolatedEndpointPathString = (() => {
            if (pathParams.length > 0) {
              if (!accumulator[entityGroupName].apiModuleImports[PATHS_LIB]) {
                accumulator[entityGroupName].apiModuleImports[PATHS_LIB] = [];
              }
              if (
                !accumulator[entityGroupName].apiModuleImports[
                  PATHS_LIB
                ].includes(`getInterpolatedPath`)
              ) {
                accumulator[entityGroupName].apiModuleImports[PATHS_LIB].push(
                  `getInterpolatedPath`
                );
              }
              return `getInterpolatedPath(${endpointPathIdentifierString}, {
                ${pathParams.map(({ name }) => name).join(',\n')}
              })`;
            }
            return endpointPathIdentifierString;
          })();

          const interpolatedEndpointPathWithQueryParamsString = (() => {
            if (queryParams.length > 0) {
              if (!accumulator[entityGroupName].apiModuleImports[PATHS_LIB]) {
                accumulator[entityGroupName].apiModuleImports[PATHS_LIB] = [];
              }
              if (
                !accumulator[entityGroupName].apiModuleImports[
                  PATHS_LIB
                ].includes(`addSearchParams`)
              ) {
                accumulator[entityGroupName].apiModuleImports[PATHS_LIB].push(
                  `addSearchParams`
                );
              }
              return `addSearchParams(${interpolatedEndpointPathString}, {...queryParams})`;
            }
            return interpolatedEndpointPathString;
          })();

          const returnTypeString = (() => {
            if (apiReturnTypeInterfaceName) {
              return apiReturnTypeInterfaceName;
            }
            return 'any';
          })();

          accumulator[entityGroupName].actions.push({
            name,
            enpointPathString,
            endpointPathIdentifierString,
            snippet: `
              ${jsDocCommentSnippet}
              export const ${name} = async (${paramsString}) => {
                const { data } = await ${httpActionString}<${returnTypeString}>(${interpolatedEndpointPathWithQueryParamsString}, {
                  label: '${actionDescription}',${
              headerParams.length > 0 ? '\nheaders,' : ''
            }${apiRequestBodyTypeInterfaceName ? '\ndata: requestPayload,' : ''}
                  ...rest,
                });
                return data;
              };
            `
              .trimIndent()
              .trim(),
          });
        }
      });
      return accumulator;
    },
    {} as Record<string, APIEntity>
  );

  // Outputting all Schemas
  if (swaggerDocs.components?.schemas) {
    const interfacesFilePath = `${outputRootPath}/interfaces/Utils.ts`;
    ensureDirSync(dirname(interfacesFilePath));
    writeFileSync(
      interfacesFilePath,
      prettier.format(
        Object.keys(swaggerDocs.components.schemas)
          .map((schemaKey) => {
            const schemaPropertiesString = getInterfaceProperties(
              swaggerDocs,
              schemaKey,
              {
                expandRefs: false,
              }
            );
            return `export type ${schemaKey} = ${schemaPropertiesString}`;
          })
          .join('\n\n'),
        {
          filepath: interfacesFilePath,
          ...prettierConfig,
        }
      )
    );
  }

  // Outputting files
  Object.values(entities).forEach(
    ({
      entityNameCamelCase,
      entityNamePascalCase,
      entityNameUpperCase,
      actions,
      apiModuleImports,
      endpointPaths,
      interfaceSnippets,
    }) => {
      // API files
      const apiFilePath = `${outputRootPath}/api/${entityNamePascalCase}.ts`;
      const importsString = Object.keys(apiModuleImports)
        .map((key) => {
          return `import {${apiModuleImports[key].join(', ')}} from '${key}';`;
        })
        .join('\n');
      const actionsString = actions
        .map(({ snippet }) => {
          return snippet;
        })
        .join('\n\n');

      ensureDirSync(dirname(apiFilePath));
      writeFileSync(
        apiFilePath,
        prettier.format(
          `
            ${importsString}
            ${actionsString}
          `,
          {
            filepath: apiFilePath,
            ...prettierConfig,
          }
        )
      );

      // Data keys files
      const dataKeysFilePath = `${outputRootPath}/data-keys/${entityNamePascalCase}.ts`;
      ensureDirSync(dirname(dataKeysFilePath));
      writeFileSync(
        dataKeysFilePath,
        prettier.format(
          `export const ${entityNameUpperCase}_DATA_KEY = '${entityNameCamelCase}';`,
          {
            filepath: dataKeysFilePath,
            ...prettierConfig,
          }
        )
      );

      // Endpoint paths files
      const endpointPathsFilePath = `${outputRootPath}/endpoint-paths/${entityNamePascalCase}.ts`;
      ensureDirSync(dirname(endpointPathsFilePath));
      writeFileSync(
        endpointPathsFilePath,
        prettier.format(
          Object.keys(endpointPaths)
            .map((key) => {
              return `export const ${key} = '${endpointPaths[key]}';`;
            })
            .join('\n'),
          {
            filepath: endpointPathsFilePath,
            ...prettierConfig,
          }
        )
      );

      // Interfaces files
      const interfacesFileContents = Object.values(interfaceSnippets)
        .join('\n\n')
        .trim();
      if (interfacesFileContents.length > 0) {
        const interfacesFilePath = `${outputRootPath}/interfaces/${entityNamePascalCase}.ts`;
        ensureDirSync(dirname(interfacesFilePath));
        writeFileSync(
          interfacesFilePath,
          prettier.format(interfacesFileContents, {
            filepath: interfacesFilePath,
            ...prettierConfig,
          })
        );
      }
    }
  );

  // Outputting index export files
  ouputSubFolders.forEach((subFolderName) => {
    const indexFilePath = `${outputRootPath}/${subFolderName}/index.ts`;
    ensureDirSync(dirname(indexFilePath));
    writeFileSync(
      indexFilePath,
      prettier.format(
        [
          ...Object.values(entities).map(
            ({ entityNamePascalCase }) => entityNamePascalCase
          ),
          ...(() => {
            switch (subFolderName) {
              case 'api':
                return ['Adapter'];
              case 'interfaces':
                return ['Utils'];
            }
            return [];
          })(),
        ]
          .filter((importFileName) => {
            return existsSync(
              `${outputRootPath}/${subFolderName}/${importFileName}.ts`
            );
          })
          .map((importFileName) => {
            return `export * from './${importFileName}';`;
          })
          .sort()
          .join('\n'),
        {
          filepath: indexFilePath,
          ...prettierConfig,
        }
      )
    );
  });

  // Outputting api adapter file
  const apiAdapterFilePath = `${outputRootPath}/api/Adapter.ts`;

  if (!existsSync(apiAdapterFilePath)) {
    ensureDirSync(dirname(apiAdapterFilePath));
    writeFileSync(
      apiAdapterFilePath,
      prettier.format(`export * from '@infinite-debugger/axios-api-adapter';`, {
        filepath: apiAdapterFilePath,
        ...prettierConfig,
      })
    );
  }

  // Outputting index file
  const indexFilePath = `${outputRootPath}/index.ts`;
  if (!existsSync(indexFilePath)) {
    ensureDirSync(dirname(indexFilePath));
    writeFileSync(
      indexFilePath,
      prettier.format(
        ouputSubFolders
          .map((subFolderName) => {
            return `export * from './${subFolderName}';`;
          })
          .join('\n'),
        {
          filepath: indexFilePath,
          ...prettierConfig,
        }
      )
    );
  }
};
