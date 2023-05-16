# swagger-to-ts

swagger-to-ts is a powerful library that allows you to generate TypeScript code from Swagger documentation or OpenAPI specifications. It simplifies the process of integrating API definitions into your TypeScript projects, saving you time and effort.

## Features

- Generate TypeScript interfaces and types from Swagger or OpenAPI specifications.
- Supports both Swagger 2.0 and OpenAPI 3.0 specifications.
- Provides strong type safety by inferring data types, request bodies, response schemas, and more.
- Supports various data types including primitive types, arrays, objects, and enums.
- Handles nested structures and complex data models.
- Generates client code for making API calls with type-checked parameters and responses.
- Supports customization through options and templates.
- Lightweight and easy to integrate into your existing TypeScript projects.

## Installation

You can install swagger-to-ts using npm:

```sh
npm install @infinite-debugger/swagger-to-ts
```

Or if you prefer yarn:

```sh
yarn add @infinite-debugger/swagger-to-ts
```

## Usage

swagger-to-ts provides a simple and straightforward API to generate TypeScript code from Swagger or OpenAPI specifications.

### Generate TypeScript Code

To generate TypeScript code, you need to provide your Swagger or OpenAPI specification object and specify an output directory.

```typescript
import { generateTypescriptAPI } from '@infinite-debugger/swagger-to-ts';

generateTypescriptAPI({
  openAPISpecification,
  outputRootPath: `/path/to/output`,
});
```

### Options

swagger-to-ts provides several options to customize the generated TypeScript code:

- `openAPISpecification`: The OpenAPI specification to generate the Typescript API from.
- `outputRootPath`: The root path to output the generated Typescript API to.
- `outputInternalState`: Whether to output the internal state of the Typescript API generator.
- `requestOperationNameSource`: The source to use for the operation name of each request. The default value is `'requestSummary'`. The other option is `'requestOperationId'`.
- `generateTsedControllers`: Whether to generate TSED controllers.
- `tsedAuthenticateDecoratorImportPath`: The import path to use for the Ts.ED `Authenticate` decorator.
- `inferTypeFromValidationSchema`: Whether to infer the type from the validation schema.

Here's an example that demonstrates how to use these options:

```typescript
import { generateTypescriptAPI } from '@infinite-debugger/swagger-to-ts';

generateTypescriptAPI({
  openAPISpecification,
  outputRootPath: `/path/to/output`,
  outputInternalState: true,
  generateTsedControllers: true,
  inferTypeFromValidationSchema: false,
  tsedAuthenticateDecoratorImportPath: '../decorators',
  requestOperationNameSource: 'requestSummary',
});
```

### CLI

swagger-to-ts also provides a command-line interface (CLI) to generate TypeScript code. You can install the CLI globally using npm:

```sh
npm install -g @infinite-debugger/swagger-to-ts
```

Certainly! The swagger-to-ts command-line interface (CLI) allows you to generate TypeScript code directly from your terminal. Here's how you can use it:

```sh
swagger-to-ts [options] -f <specPath> -o <outputPath>
```

Replace `<specPath>` with the path to your Swagger or OpenAPI specification file, and `<outputPath>` with the directory where you want to generate the TypeScript code.

#### Options

The swagger-to-ts CLI supports the following options:

- `-o, --output <directory>`: Specifies the output directory for the generated TypeScript code. If not provided, the code will be generated in the current directory.
- `-f, --file <file>`: Specifies the Swagger document or OpenAPI specification file to use for generating the TypeScript code. If not provided, the application will look for a file named swagger.json in the current directory.
- `-h, --help`: Displays the help text and usage instructions for the command line application.
- `-v, --version`: Displays the version information of the swagger-to-ts command line application.
- `-wIS, --write-internal-state`: Outputs the internal state of the application to the output directory. This is useful for debugging purposes.
- `-rONS, --request-operation-name-source`: Specifies the source for the request operation name. Valid values are 'path' and 'operationId'. If not provided, the default value is 'path'.
- `-gTC, --generate-tsed-controllers`: Generates controllers for the Ts.ED framework. If not provided, the default value is 'false'.
- `-tADIP, --tsed-authenticate-decorator-import-path`: Specifies the import path for the Ts.ED @Authenticate decorator. If not provided, the default value is '@tsed/common'.
- `-niTFVS, --no-infer-type-from-validation-schema`: Disables the automatic inference of TypeScript types from the validation schema. If not provided, the default value is 'false'.

#### Examples

Here are a few examples demonstrating the usage of the swagger-to-ts CLI:

```sh
swagger-to-ts -f /path/to/swagger.json -o /path/to/output
```

Generate TypeScript code from the Swagger file located at `/path/to/swagger.json` and output the generated code to the directory `/path/to/output`.

That's it! You can now use the swagger-to-ts CLI to generate TypeScript code from your Swagger or OpenAPI specifications with ease.
