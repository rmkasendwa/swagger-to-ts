import { z } from 'zod';

import { Components, ComponentsValidationSchema } from './Components';
import { Request, RequestValidationSchema } from './Request';

//#region OpenAPISpecificationInfo
export const InfoValidationSchema = z.object({
  version: z.string().describe('The open api version.'),
  title: z.string().describe('The open api title.'),
  description: z.string().optional().describe('The open api description.'),
});

export type Info = z.infer<typeof InfoValidationSchema>;
//#endregion

//#region SecurityScheme
export const SecurityValidationSchema = z.union([
  z.object({
    APIKeyAuth: z.array(z.any()).describe('The API key authentication.'),
  }),
  z.object({
    apikeyAuth: z.array(z.any()).describe('The API key authentication.'),
  }),
  z.object({
    BearerAuth: z.array(z.any()).describe('The bearer authentication.'),
  }),
]);

export type Security = z.infer<typeof SecurityValidationSchema>;
//#endregion

//#region Tag
export const TagValidationSchema = z.object({
  name: z.string().describe('The tag name.'),
  description: z.string().optional().describe('The tag description.'),
});

export type Tag = z.infer<typeof TagValidationSchema>;
//#endregion

export const OpenAPISpecificationValidationSchema = z.object({
  openapi: z
    .string()
    .describe(
      'This string MUST be the version number of the OpenAPI Specification that the OpenAPI document uses. The openapi field SHOULD be used by tooling to interpret the OpenAPI document. This is not related to the API info.version string.'
    ),
  info: InfoValidationSchema.describe(
    'Provides metadata about the API. The metadata MAY be used by tooling as required.'
  ),
  components: ComponentsValidationSchema.describe(
    'An element to hold various schemas for the document.'
  ),
  security: z
    .array(SecurityValidationSchema)
    .optional()
    .describe(
      'A declaration of which security mechanisms can be used across the API. The list of values includes alternative security requirement objects that can be used. Only one of the security requirement objects need to be satisfied to authorize a request. Individual operations can override this definition. To make security optional, an empty security requirement ({}) can be included in the array.'
    ),
  paths: z
    .record(z.record(RequestValidationSchema))
    .describe('The available paths and operations for the API.'),
  tags: z
    .array(TagValidationSchema)
    .describe(
      "A list of tags used by the document with additional metadata. The order of the tags can be used to reflect on their order by the parsing tools. Not all tags that are used by the Operation Object must be declared. The tags that are not declared MAY be organized randomly or based on the tools' logic. Each tag name in the list MUST be unique."
    ),
});

export type OpenAPISpecification = {
  /**
   * This string MUST be the version number of the OpenAPI Specification that the OpenAPI document uses.
   * The openapi field SHOULD be used by tooling to interpret the OpenAPI document.
   * This is not related to the API info.version string.
   */
  openapi: string;

  /**
   * Provides metadata about the API. The metadata MAY be used by tooling as required.
   */
  info: Info;

  /**
   * An element to hold various schemas for the document.
   */
  components: Components;

  /**
   * A declaration of which security mechanisms can be used across the API.
   * The list of values includes alternative security requirement objects that can be used.
   * Only one of the security requirement objects need to be satisfied to authorize a request.
   * Individual operations can override this definition.
   * To make security optional, an empty security requirement ({}) can be included in the array.
   */
  security?: Security[];

  /**
   * The available paths and operations for the API.
   */
  paths: Record<string, Record<string, Request>>;

  /**
   * A list of tags used by the document with additional metadata.
   * The order of the tags can be used to reflect on their order by the parsing tools.
   * Not all tags that are used by the Operation Object must be declared.
   * The tags that are not declared MAY be organized randomly or based on the tools' logic.
   * Each tag name in the list MUST be unique.
   */
  tags: Tag[];
};
