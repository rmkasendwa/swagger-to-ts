import '@infinite-debugger/rmk-js-extensions/String';

import { OS3Parameter, OS3Paths, OpenSpec3 } from '@tsed/openspec';

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
  actions: APIAction[];
}

const swaggerDocs: OpenSpec3 = require('../swagger.json');

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
        if (!accumulator[entityGroupName]) {
          accumulator[entityGroupName] = {
            actions: [],
          };
        }
        const name = summary.toCamelCase();
        const endpointPathIdentifierString = `${summary
          .replace(/\s+/g, '_')
          .toUpperCase()}_ENDPOINT_PATH`;
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

        const pathParamsString = pathParams
          .map(({ name, type }) => {
            return `${name}: ${type}`;
          })
          .join(', ');

        accumulator[entityGroupName].actions.push({
          name,
          httpVerb,
          enpointPathString,
          endpointPathIdentifierString,
          actionDescription,
          pathParams,
          snippet: `
            export const ${name} = async (${pathParamsString}) => {
              const { data } = await ${httpVerb}<Country[]>(${endpointPathIdentifierString}, {
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

console.log(JSON.stringify(entities, null, 2));
