import { OpenSpec3 } from '@tsed/openspec';
import { get } from 'lodash';

export interface GetInterfacePropertiesOptions {
  swaggerDocs: OpenSpec3;
  modelName: string;
  baseModelRefPath: string;
  expandRefs?: boolean;
}

export const getModelDefinitions = ({
  swaggerDocs,
  baseModelRefPath,
  modelName,
  expandRefs,
}: GetInterfacePropertiesOptions): {
  modelDefinition: string;
  dependencyModelDefinitions: string[];
} => {
  const dependencyModelDefinitions: string[] = [];
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
        const {
          propertyType,
          dependencyModelDefinitions: propertyTypedependencyModelDefinitions,
        } = getModelPropertyType({
          modelSchema: modelProperties[key],
          swaggerDocs,
          modelName,
          propertyName: key,
          expandRefs,
        });
        dependencyModelDefinitions.push(
          ...propertyTypedependencyModelDefinitions
        );
        if (modelRequiredProperties.includes(key)) {
          return `'${key}': ${propertyType}`;
        }
        return `'${key}'?: ${propertyType}`;
      })
      .join(';\n');

    return {
      modelDefinition: `export type ${modelName} = {\n${modelPropertiesString}\n}`,
      dependencyModelDefinitions,
    };
  }
  return {
    modelDefinition: `export type ${modelName} = {}`,
    dependencyModelDefinitions,
  };
};

export interface GetInterfacePropertyTypeOptions {
  swaggerDocs: OpenSpec3;
  modelSchema: any;
  propertyName: string;
  modelName: string;
  expandRefs?: boolean;
}

export const getModelPropertyType = (
  options: GetInterfacePropertyTypeOptions
): {
  propertyType: string;
  dependencyModelDefinitions: string[];
} => {
  const dependencyModelDefinitions: string[] = [];
  const {
    swaggerDocs,
    modelSchema,
    expandRefs = true,
    modelName,
    propertyName,
  } = options;
  if (Array.isArray(modelSchema.enum)) {
    const enumValues = (() => {
      return modelSchema.enum.map((enumValue: any) => {
        if (typeof enumValue === 'string') {
          if (enumValue.match(/^#\//g)) {
            if (expandRefs) {
              const nestedModelName = `${modelName.toPascalCase()}${propertyName.toPascalCase()}`;
              const {
                modelDefinition,
                dependencyModelDefinitions: modeldependencyModelDefinitions,
              } = getModelDefinitions({
                swaggerDocs,
                baseModelRefPath: enumValue,
                modelName: nestedModelName,
                expandRefs,
              });
              dependencyModelDefinitions.push(
                ...modeldependencyModelDefinitions,
                modelDefinition
              );
              return nestedModelName;
            } else {
              return enumValue.split('/').slice(-1)[0];
            }
          }
          if (enumValue.includes('"') && !enumValue.includes("'")) {
            return `'${enumValue}'`;
          }
          return `"${enumValue.replace(/(['"])/g, '\\$1')}"`;
        }
        return enumValue;
      });
    })();
    if (enumValues.length > 0) {
      if (modelName && propertyName) {
        const propertyType = `${modelName.toPascalCase()}${propertyName.toPascalCase()}`;
        const optionsVariableName = `${
          propertyType.charAt(0).toLowerCase() + propertyType.slice(1)
        }Options`;
        dependencyModelDefinitions.push(
          `
          export const ${optionsVariableName} = [${enumValues.join(
            ', '
          )}] as const;

          export type ${propertyType} = typeof ${optionsVariableName}[number];
        `.trimIndent()
        );
        return {
          propertyType: propertyType,
          dependencyModelDefinitions,
        };
      }
      return {
        propertyType: enumValues.join(' | '),
        dependencyModelDefinitions,
      };
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
              const nestedModelName = `${modelName.toPascalCase()}${propertyName.toPascalCase()}`;
              const {
                modelDefinition,
                dependencyModelDefinitions: modeldependencyModelDefinitions,
              } = getModelDefinitions({
                swaggerDocs,
                baseModelRefPath: modelSchema.items.$ref,
                modelName: nestedModelName,
                expandRefs,
              });
              dependencyModelDefinitions.push(
                ...modeldependencyModelDefinitions,
                modelDefinition
              );
              return nestedModelName;
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
    return {
      propertyType: type,
      dependencyModelDefinitions,
    };
  }
  if (modelSchema.$ref) {
    if (expandRefs) {
      const nestedModelName = `${modelName.toPascalCase()}${propertyName.toPascalCase()}`;
      const {
        modelDefinition,
        dependencyModelDefinitions: modeldependencyModelDefinitions,
      } = getModelDefinitions({
        swaggerDocs,
        baseModelRefPath: modelSchema.$ref,
        modelName: nestedModelName,
        expandRefs,
      });
      dependencyModelDefinitions.push(
        ...modeldependencyModelDefinitions,
        modelDefinition
      );
      return {
        propertyType: nestedModelName,
        dependencyModelDefinitions,
      };
    } else {
      return {
        propertyType: modelSchema.$ref.split('/').slice(-1)[0],
        dependencyModelDefinitions,
      };
    }
  }
  return {
    propertyType: 'any',
    dependencyModelDefinitions,
  };
};
