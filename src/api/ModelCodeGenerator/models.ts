import { ModuleImports, TsedModelProperty } from '../../models';

export type SchemaCodeConfiguration = Omit<
  TsedModelProperty,
  'typeDefinitionSnippet'
> & {
  zodCodeString: string;
};

export interface SchemaCodeGeneratorFunctionOptions<Schema> {
  /**
   * The string schema to generate code for
   */
  schema: Schema;

  /**
   * The name of the schema to generate code for
   */
  schemaName: string;

  /**
   * The name of the property on the schema to generate code for
   */
  propertyName: string;

  /**
   * Whether to generate code for tsed controllers
   */
  generateTsEDControllers?: boolean;

  /**
   * The module imports to add to the generated code
   */
  imports: ModuleImports;

  /**
   * The generated variables to add to the generated code
   */
  generatedVariables: Record<string, string>;
}

/**
 * A function that generates code for a given schema
 *
 * @param options The options to generate code for a schema
 * @returns The generated code for the schema
 */
export type SchemaCodeGeneratorFunction<Schema> = (
  options: SchemaCodeGeneratorFunctionOptions<Schema>
) => Partial<SchemaCodeConfiguration>;
