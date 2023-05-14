import { z } from 'zod';

import { ContentValidationSchema } from './Content';

//#region Response
export const ResponseValidationSchema = z.object({
  content: ContentValidationSchema.nullish().describe('The response content.'),
  description: z.string().optional().describe('The response description.'),
});
export type Response = z.infer<typeof ResponseValidationSchema>;
//#endregion

//#region Responses
export const ResponsesValidationSchema = z.record(ResponseValidationSchema);
export type Responses = z.infer<typeof ResponsesValidationSchema>;
//#endregion
