import '@infinite-debugger/rmk-js-extensions/String';

import { writeFileSync } from 'fs';
import { dirname } from 'path';

import { OS3Parameter, OS3Paths, OpenSpec3 } from '@tsed/openspec';
import { ensureDirSync } from 'fs-extra';

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
}

const swaggerDocs: OpenSpec3 = require('../swagger.json');

const outputFolderPath = `${__dirname}/__sandbox`;

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
        const entityNameUpperCase = summary.replace(/\s+/g, '_').toUpperCase();
        if (!accumulator[entityGroupName]) {
          accumulator[entityGroupName] = {
            entityNameCamelCase,
            entityNamePascalCase,
            entityNameUpperCase,
            actions: [],
            apiModuleImports: {},
          };
        }

        const endpointPathsFileLocationRelativetoAPI = `../endpoint-paths/${entityNamePascalCase}`;

        const name = summary.toCamelCase();

        const endpointPathIdentifierString = `${entityNameUpperCase}_ENDPOINT_PATH`;

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

        const enpointPathString = pathKey.replace(/\{(\w+)\}/g, ':$1');

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

        accumulator[entityGroupName].actions.push({
          name,
          httpVerb,
          enpointPathString,
          endpointPathIdentifierString,
          actionDescription,
          pathParams,
          snippet: `
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

// Outputing files
Object.values(entities).forEach(
  ({
    entityNameCamelCase,
    entityNamePascalCase,
    entityNameUpperCase,
    actions,
    apiModuleImports,
  }) => {
    // API Files
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
      `
        ${importsString}
        ${actionsString}
      `
    );

    // Data Keys Files
    const dataKeysFilePath = `${outputFolderPath}/data-keys/${entityNamePascalCase}.ts`;
    ensureDirSync(dirname(dataKeysFilePath));
    writeFileSync(
      dataKeysFilePath,
      `export const ${entityNameUpperCase}_DATA_KEY = '${entityNameCamelCase}';`
    );
  }
);

console.log(JSON.stringify(entities, null, 2));
