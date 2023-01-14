import { OpenSpec3 } from '@tsed/openspec';
import { get } from 'lodash';

export interface GetInterfacePropertiesOptions {
  expandRefs?: boolean;
}

export const getInterfaceProperties = (
  swaggerDocs: OpenSpec3,
  baseModelRefPath: string,
  options: GetInterfacePropertiesOptions = {}
): string => {
  const { expandRefs = true } = options;
  const modelPropertiesPath =
    (() => {
      if (baseModelRefPath.match(/^#\//g)) {
        return baseModelRefPath.replace(/^#\//g, '').replaceAll('/', '.');
      }
      return `components.schemas.${baseModelRefPath}`;
    })() + '.properties';
  const modelProperties = get(swaggerDocs, modelPropertiesPath);
  if (modelProperties) {
    const modelPropertiesString = Object.keys(modelProperties)
      .map((key) => {
        if (modelProperties[key].type) {
          const type = (() => {
            if (modelProperties[key].type === 'array') {
              const itemType = (() => {
                if (modelProperties[key].items?.type) {
                  return modelProperties[key].items.type;
                }
                if (modelProperties[key].items?.$ref) {
                  if (expandRefs) {
                    return `(${getInterfaceProperties(
                      swaggerDocs,
                      modelProperties[key].items.$ref,
                      options
                    )})`;
                  } else {
                    return modelProperties[key].items.$ref
                      .split('/')
                      .slice(-1)[0];
                  }
                }
                return 'any';
              })();
              return `${itemType}[]`;
            }
            return modelProperties[key].type;
          })();
          return `${key}?: ${type}`;
        }
        if (modelProperties[key].$ref) {
          if (expandRefs) {
            return `${key}?: ${getInterfaceProperties(
              swaggerDocs,
              modelProperties[key].$ref,
              options
            )}`;
          } else {
            return `${key}?: ${
              modelProperties[key].$ref.split('/').slice(-1)[0]
            }`;
          }
        }
        return `${key}?: any`;
      })
      .join(';\n');

    return `{\n${modelPropertiesString}\n}`;
  }
  return `{}`;
};
