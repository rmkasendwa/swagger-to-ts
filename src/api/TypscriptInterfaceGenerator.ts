import { OpenSpec3 } from '@tsed/openspec';
import { get } from 'lodash';

export const getInterfaceProperties = (
  swaggerDocs: OpenSpec3,
  baseModelRefPath: string
): string => {
  const modelPropertiesPath =
    baseModelRefPath.replace(/^#\//g, '').replaceAll('/', '.') + '.properties';
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
                  return `(${getInterfaceProperties(
                    swaggerDocs,
                    modelProperties[key].items?.$ref
                  )})`;
                }
                return 'any';
              })();
              return `${itemType}[]`;
            }
            return modelProperties[key].type;
          })();
          return `${key}: ${type}`;
        }
        if (modelProperties[key].$ref) {
          return `${key}: ${getInterfaceProperties(
            swaggerDocs,
            modelProperties[key].$ref
          )}`;
        }
        return `${key}: any`;
      })
      .join(';\n');

    return `{\n${modelPropertiesString}\n}`;
  }
  return `{}`;
};
