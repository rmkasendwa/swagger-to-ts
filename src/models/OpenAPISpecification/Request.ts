import { z } from 'zod';

import { Content, ContentValidationSchema } from './Content';
import { ResponsesValidationSchema } from './Response';
import { SchemaPropertyValidationSchema } from './Schema';

//#region Request methods
export const requestMethods = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
] as const;

export type RequestMethod = (typeof requestMethods)[number];
//#endregion

//#region BaseRequestParameter
export const BaseRequestParameterValidationSchema = z.object({
  required: z
    .boolean()
    .optional()
    .describe('The base request parameter required.'),
  name: z.string().describe('The base request parameter name.'),
  description: z
    .string()
    .optional()
    .describe('The base request parameter description.'),
  schema: SchemaPropertyValidationSchema.describe(
    'The base request parameter schema.'
  ),
});

export type BaseRequestParameter = z.infer<
  typeof BaseRequestParameterValidationSchema
>;
//#endregion

//#region RequestParameter
export const requestParameterLocations = ['query', 'header', 'path'] as const;
export type RequestParameterLocation =
  (typeof requestParameterLocations)[number];

export const RequestParameterValidationSchema =
  BaseRequestParameterValidationSchema.extend({
    in: z
      .enum(requestParameterLocations)
      .describe('The request parameter location.'),
  });

export type RequestParameter = BaseRequestParameter & {
  /**
   * The request parameter location.
   */
  in: RequestParameterLocation;
};
//#endregion

//#region RequestBody
export const RequestBodyValidationSchema: any = z.object({
  required: z.boolean().optional().describe('The request body required.'),
  content: ContentValidationSchema.optional().describe(
    'The request body content.'
  ),
  description: z.string().optional().describe('The request body description.'),
});

export type RequestBody = {
  required?: boolean;
  content?: Content;
  description?: string;
};
//#endregion

//#region Request
export const RequestValidationSchema = z.object({
  description: z.string().optional().describe('The request description.'),
  operationId: z.string().optional().describe('The request operation id.'),
  parameters: z
    .array(RequestParameterValidationSchema)
    .optional()
    .describe('The request parameters.'),
  requestBody:
    RequestBodyValidationSchema.optional().describe('The request body.'),
  responses: ResponsesValidationSchema.describe('The request responses.'),
  summary: z.string().optional().describe('The request summary.'),
  tags: z.array(z.string()).describe('The request tags.'),
});

export type Request = z.infer<typeof RequestValidationSchema>;
//#endregion
