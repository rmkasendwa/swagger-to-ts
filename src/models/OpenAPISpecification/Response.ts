import { z } from 'zod';

import { Content, ContentValidationSchema } from './Content';

//#region Response
export const ResponseValidationSchema: any = z.object({
  content: ContentValidationSchema.optional().describe('The response content.'),
  description: z.string().optional().describe('The response description.'),
});
export type Response = {
  content?: Content;
  description?: string;
};
//#endregion

//#region Responses
export const ResponsesValidationSchema = z.record(ResponseValidationSchema);
export type Responses = Record<string, Response>;
//#endregion
