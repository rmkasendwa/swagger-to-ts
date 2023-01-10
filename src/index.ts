import '@infinite-debugger/rmk-js-extensions/String';

import { writeFileSync } from 'fs';
import { dirname } from 'path';

import { OS3Parameter, OS3Paths, OpenSpec3 } from '@tsed/openspec';
import { ensureDirSync } from 'fs-extra';
import prettier from 'prettier';

type Parameter = {
  name: string;
  type: string;
};

interface APIAction {
  name: string;
  endpointPathIdentifierString: string;
  enpointPathString: string;
  httpVerb: string;
  pathParams: Parameter[];
  snippet: string;
  actionDescription: string;
}

interface APIEntity {
  entityNamePascalCase: string;
  entityNameUpperCase: string;
  entityNameCamelCase: string;
  apiModuleImports: Record<string, string[]>;
  actions: APIAction[];
  endpointPaths: Record<string, string>;
}

const swaggerDocs: OpenSpec3 = require('../swagger.json');

const prettierConfig: prettier.Options = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  endOfLine: 'auto',
};

const outputFolderPath = `${__dirname}/__sandbox`;
const ouputSubFolders = ['api', 'data-keys', 'endpoint-paths', 'interfaces'];

const PATHS_LIB = `@infinite-debugger/rmk-utils/paths`;
const API_ADAPTER_PATH = `./Adapter`;

// Cumulatively finding entites
const entities = Object.keys(swaggerDocs.paths).reduce(
  (accumulator, pathKey: keyof typeof swaggerDocs.paths) => {
    const swaggerDocsPath = swaggerDocs.paths[pathKey];
    Object.keys(swaggerDocsPath).forEach((key) => {
      const httpVerb = key as keyof typeof swaggerDocsPath;
      const {
        summary,
        description,
        tags,
        parameters = [],
      } = {
        ...(swaggerDocsPath[httpVerb] as any),
      } as OS3Paths & {
        tags: string[];
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
          };
        }

        const endpointPathsFileLocationRelativetoAPI = `../endpoint-paths/${entityNamePascalCase}`;

        const name = summary.toCamelCase();

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
              name: parameter.name,
              type: (parameter.schema as any).type, // TODO: Deal with complex types
            } as Parameter;
          });

        const httpActionString = (() => {
          if (httpVerb.match(/delete/gi)) {
            return `_${httpVerb}`;
          }
          return httpVerb;
        })();

        const pathParamsString = pathParams
          .map(({ name, type }) => {
            return `${name}: ${type}`;
          })
          .join(', ');

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

        if (!accumulator[entityGroupName].apiModuleImports[API_ADAPTER_PATH]) {
          accumulator[entityGroupName].apiModuleImports[API_ADAPTER_PATH] = [];
        }
        if (
          !accumulator[entityGroupName].apiModuleImports[
            API_ADAPTER_PATH
          ].includes(httpActionString)
        ) {
          accumulator[entityGroupName].apiModuleImports[API_ADAPTER_PATH].push(
            httpActionString
          );
        }

        const jsDocCommentSnippet = (() => {
          const lines: string[] = [];
          if (description) {
            lines.push(description);
          }
          if (pathParams.length > 0) {
            if (lines.length > 0) {
              lines.push('');
            }
            lines.push(
              ...pathParams.map(({ name }) => {
                return `@param ${name}`;
              })
            );
          }
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
        })();

        accumulator[entityGroupName].actions.push({
          name,
          httpVerb,
          enpointPathString,
          endpointPathIdentifierString,
          actionDescription,
          pathParams,
          snippet: `
            ${jsDocCommentSnippet}
            export const ${name} = async (${pathParamsString}) => {
              const { data } = await ${httpActionString}<any>(${interpolatedEndpointPathString}, {
                label: '${actionDescription}',
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

// Outputting files
Object.values(entities).forEach(
  ({
    entityNameCamelCase,
    entityNamePascalCase,
    entityNameUpperCase,
    actions,
    apiModuleImports,
    endpointPaths,
  }) => {
    // API files
    const apiFilePath = `${outputFolderPath}/api/${entityNamePascalCase}.ts`;
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
    const dataKeysFilePath = `${outputFolderPath}/data-keys/${entityNamePascalCase}.ts`;
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
    const endpointPathsFilePath = `${outputFolderPath}/endpoint-paths/${entityNamePascalCase}.ts`;
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
    const interfacesFilePath = `${outputFolderPath}/interfaces/${entityNamePascalCase}.ts`;
    ensureDirSync(dirname(interfacesFilePath));
    writeFileSync(
      interfacesFilePath,
      prettier.format(
        `
        // TODO: Implement the interfaces
        export {};
      `,
        {
          filepath: interfacesFilePath,
          ...prettierConfig,
        }
      )
    );
  }
);

// Outputting index export files
ouputSubFolders.forEach((subFolderName) => {
  const indexFilePath = `${outputFolderPath}/${subFolderName}/index.ts`;
  ensureDirSync(dirname(indexFilePath));
  writeFileSync(
    indexFilePath,
    prettier.format(
      Object.values(entities)
        .map(({ entityNamePascalCase }) => {
          return `export * from './${entityNamePascalCase}';`;
        })
        .join('\n'),
      {
        filepath: indexFilePath,
        ...prettierConfig,
      }
    )
  );
});

// Outputting api adapter file
const apiAdapterFilePath = `${outputFolderPath}/api/Adapter.ts`;

ensureDirSync(dirname(apiAdapterFilePath));
writeFileSync(
  apiAdapterFilePath,
  prettier.format(`export * from '@infinite-debugger/axios-api-adapter';`, {
    filepath: apiAdapterFilePath,
    ...prettierConfig,
  })
);

// Outputting index file
const indexFilePath = `${outputFolderPath}/index.ts`;

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
