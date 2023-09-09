import { z } from 'zod';

export const RefSchemaValidationSchema = z.object({
  $ref: z
    .string()
    .describe('The reference identifier. This MUST be in the form of a URI.'),
  summary: z
    .string()
    .optional()
    .describe(
      'A short summary which by default SHOULD override that of the referenced component. If the referenced object-type does not allow a summary field, then this field has no effect.'
    ),
  description: z
    .string()
    .optional()
    .describe(
      'A description which by default SHOULD override that of the referenced component. CommonMark syntax MAY be used for rich text representation. If the referenced object-type does not allow a description field, then this field has no effect.'
    ),
});

export type RefSchema = z.infer<typeof RefSchemaValidationSchema>;
