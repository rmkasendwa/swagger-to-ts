import { pkg } from '../config';
import { ModuleImports } from '../models';

//#region Add module import
export interface AddModuleImportOptions {
  imports: ModuleImports;
  importFilePath: string;
  importName: string;
  isDefaultImport?: boolean;
}
export const addModuleImport = ({
  imports,
  importFilePath,
  importName,
}: AddModuleImportOptions) => {
  if (!imports[importFilePath]) {
    imports[importFilePath] = [];
  }
  if (!imports[importFilePath].includes(importName)) {
    imports[importFilePath].push(importName);
  }
};
//#endregion

//#region get imports code
export interface GetImportsCodeOptions {
  imports?: ModuleImports;
}
export const getImportsCode = ({ imports }: GetImportsCodeOptions) => {
  if (imports) {
    return Object.keys(imports!).map((importFilePath) => {
      const importNames = imports![importFilePath];
      return `import { ${importNames.join(', ')} } from '${importFilePath}';`;
    });
  }
  return [];
};
//#endregion

//#region Get auto-generated file warning comment
export const getGeneratedFileWarningComment = () => {
  return `
    /**
     * AUTO-GENERATED FILE
     *
     * WARNING: DO NOT MODIFY THIS FILE MANUALLY
     *
     * This file has been automatically generated by the ${pkg.name} library.
     * Any manual changes made to this file will be overwritten the next time the library is run.
     * If you need to make changes to the TypeScript definitions, modify the OpenAPI specification file
     * and regenerate the TypeScript code using the ${pkg.name} library.
     */
  `.trimIndent();
};
//#endregion

//#region Get help text
export const getHelpText = () => {
  return `
    ${pkg.name}

    Description:
    ${pkg.name} is a powerful tool that allows you to effortlessly generate TypeScript code from Swagger documents or OpenAPI specifications. This tool streamlines the process of creating strongly typed models, API clients, and request/response objects in TypeScript, saving you valuable development time.

    Usage:
    swagger-to-ts [options]

    Options:
    -o, --output <directory>: Specifies the output directory for the generated TypeScript code. If not provided, the code will be generated in the current directory.
    -f, --file <file>: Specifies the Swagger document or OpenAPI specification file to use for generating the TypeScript code. If not provided, the application will look for a file named swagger.json in the current directory.
    -h, --help: Displays the help text and usage instructions for the command line application.
    -v, --version: Displays the version information of the swagger-to-ts command line application.
    -wIS, --write-internal-state: Outputs the internal state of the application to the output directory. This is useful for debugging purposes.
    -rONS, --request-operation-name-source: Specifies the source for the request operation name. Valid values are 'path' and 'operationId'. If not provided, the default value is 'path'.
    -gTC, --generate-tsed-controllers: Generates controllers for the Ts.ED framework. If not provided, the default value is 'false'.
    -tADIP, --tsed-authenticate-decorator-import-path: Specifies the import path for the Ts.ED @Authenticate decorator. If not provided, the default value is '@tsed/common'.
    -tCNP, --tsed-controller-name-prefix: Specifies the prefix to use for the Ts.ED controller names.
    -tCNS, --tsed-controller-name-suffix: Specifies the suffix to use for the Ts.ED controller names.
    -niTFVS, --no-infer-type-from-validation-schema: Disables the automatic inference of TypeScript types from the validation schema. If not provided, the default value is 'false'.
    -sN, --scope-name: Specifies the name of the scope to use for the generated TypeScript code.

    Example:
    To generate TypeScript code from a Swagger document named swagger.json and save it in a directory named generated, you can use the following command:
    swagger-to-ts -o generated swagger.json

    Additional Information:
    - ${pkg.name} uses the Swagger/OAS specification to generate TypeScript code.
    - The generated TypeScript code includes interfaces for models, request/response objects, and API client classes.
    - The application attempts to infer appropriate TypeScript types based on the Swagger document's schema definitions.
    - If you encounter any issues or need further assistance, please refer to the ${pkg.name} documentation for troubleshooting and examples.

    Remember to have the necessary dependencies installed and accessible in your environment before running the ${pkg.name} command line application.

    For more information, please visit the ${pkg.name} GitHub repository or the official Swagger documentation.
  `.trimIndent();
};
//#endregion
