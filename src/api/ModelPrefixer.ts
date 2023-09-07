import { cloneDeep } from 'lodash';

import { ENVIRONMENT_DEFINED_MODELS, OpenAPISpecification } from '../models';

export interface PrefixModelsAndModelReferencesOptions {
  openAPISpecification: OpenAPISpecification;
  prefix: string;
}

export const prefixModelsAndModelReferences = ({
  openAPISpecification: inputOpenAPISpecification,
  prefix,
}: PrefixModelsAndModelReferencesOptions) => {
  const openAPISpecification = cloneDeep(inputOpenAPISpecification);

  //#region Prefix models
  Object.entries(openAPISpecification.components.schemas).forEach(
    ([key, value]) => {
      if (!ENVIRONMENT_DEFINED_MODELS.includes(key as any)) {
        delete openAPISpecification.components.schemas[key];
        openAPISpecification.components.schemas[`${prefix}${key}`] = value;
      }
    }
  );
  //#endregion

  //#region Prefix model references
  const prefixPropertyValues = (obj: any): void => {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      return obj.forEach((item) => prefixPropertyValues(item));
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const match = /^#\/components\/schemas\/(\w+)$/g.exec(value);
        if (match && !ENVIRONMENT_DEFINED_MODELS.includes(match[1] as any)) {
          obj[key] = `#/components/schemas/${prefix}${match[1]}`;
        }
      } else if (typeof value === 'object' && value !== null) {
        prefixPropertyValues(value);
      }
    });
  };

  prefixPropertyValues(openAPISpecification);
  //#endregion
  return openAPISpecification;
};
