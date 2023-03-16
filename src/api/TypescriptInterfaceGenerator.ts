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
  const modelPath = (() => {
    if (baseModelRefPath.match(/^#\//g)) {
      return baseModelRefPath.replace(/^#\//g, '').replaceAll('/', '.');
    }
    return `components.schemas.${baseModelRefPath}`;
  })();
  const modelPropertiesPath = modelPath + '.properties';
  const modelRequiredPropertiesPath = modelPath + '.required';
  const modelProperties = get(swaggerDocs, modelPropertiesPath);
  const modelRequiredProperties: string[] =
    get(swaggerDocs, modelRequiredPropertiesPath) || [];
  if (modelProperties) {
    const modelPropertiesString = Object.keys(modelProperties)
      .map((key) => {
        const interfacePropertyTypeString = getInterfacePropertyType(
          modelProperties[key],
          swaggerDocs,
          options
        );
        if (modelRequiredProperties.includes(key)) {
          return `'${key}': ${interfacePropertyTypeString}`;
        }
        return `'${key}'?: ${interfacePropertyTypeString}`;
      })
      .join(';\n');

    return `{\n${modelPropertiesString}\n}`;
  }
  return `{}`;
};

export const getInterfacePropertyType = (
  modelSchema: any,
  swaggerDocs: OpenSpec3,
  options: GetInterfacePropertiesOptions = {}
) => {
  const { expandRefs = true } = options;
  if (Array.isArray(modelSchema.enum)) {
    const enumTypeString = (() => {
      return modelSchema.enum
        .map((enumValue: any) => {
          if (typeof enumValue === 'string') {
            if (enumValue.match(/^#\//g)) {
              if (expandRefs) {
                return `(${getInterfaceProperties(
                  swaggerDocs,
                  enumValue,
                  options
                )})`;
              } else {
                return enumValue.split('/').slice(-1)[0];
              }
            }
            return `"${enumValue}"`;
          }
          return enumValue;
        })
        .join(' | ');
    })();
    if (enumTypeString.length > 0) {
      return enumTypeString;
    }
  }
  if (modelSchema.type) {
    const type = (() => {
      if (modelSchema.type === 'array') {
        const itemType = (() => {
          if (modelSchema.items?.type) {
            return modelSchema.items.type;
          }
          if (modelSchema.items?.$ref) {
            if (expandRefs) {
              return `(${getInterfaceProperties(
                swaggerDocs,
                modelSchema.items.$ref,
                options
              )})`;
            } else {
              return modelSchema.items.$ref.split('/').slice(-1)[0];
            }
          }
          return 'any';
        })();
        return `${itemType}[]`;
      }
      return modelSchema.type;
    })();
    return type;
  }
  if (modelSchema.$ref) {
    if (expandRefs) {
      return getInterfaceProperties(swaggerDocs, modelSchema.$ref, options);
    } else {
      return modelSchema.$ref.split('/').slice(-1)[0];
    }
  }
  return 'any';
};
