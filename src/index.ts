import '@infinite-debugger/rmk-js-extensions/String';

import { OpenSpec3 } from '@tsed/openspec';

interface APIAction {
  name: string;
  endpointPathIdentifierString: string;
  enpointPathString: string;
  httpVerb: string;
  parameters: string[];
  snippet: string;
}

interface APIEntity {
  actions: APIAction[];
}

const swaggerDocs: OpenSpec3 = require('../swagger.json');

// Cumulatively finding entites
const entities = Object.keys(swaggerDocs.paths).reduce(
  (accumulator, pathKey) => {
    Object.keys(swaggerDocs.paths[pathKey]).forEach((httpVerb) => {
      const { summary, tags } = (swaggerDocs.paths as any)[pathKey][
        httpVerb
      ] as {
        summary?: string;
        tags?: string[];
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
        const enpointPathString = pathKey.replace(/\{(\w+)\}/g, ':$1');

        accumulator[entityGroupName].actions.push({
          name,
          httpVerb,
          enpointPathString,
          endpointPathIdentifierString,
          parameters: [],
          snippet: `
            export const ${name} = async () => {
              const { data } = await ${httpVerb}<Country[]>(${endpointPathIdentifierString}, {
                label: 'Loading Countries',
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
