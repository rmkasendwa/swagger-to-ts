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

```shell
npm install @infinite-debugger/swagger-to-ts
```

Or if you prefer yarn:

```shell
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

- `template`: Specify a custom template file or directory to override the default code generation. See [Custom Templates](#custom-templates) for more details.
- `skipTypeChecking`: Skip type-checking generated code during compilation. This option can be useful if you want to generate the code without actually compiling it.
- `useOptionsInterfaces`: Generate interfaces for operation options. This can be useful when using a library like axios to make API calls.
- `namingConvention`: Specify a custom naming convention for generated types and interfaces. The default value is `'pascal-case'`. Other options include `'camel-case'`, `'kebab-case'`, and `'snake-case'`.

Here's an example that demonstrates how to use these options:

```typescript
import { generateTypes, NamingConvention } from '@infinite-debugger/swagger-to-ts';

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

### Custom Templates

swagger-to-ts allows you to customize the generated code by providing your own template files or directory. You can override individual template files or the entire directory.

To override the default templates, create a new directory and copy the desired template files into it. Modify the copied files according to your requirements. Then, specify the path to your custom template directory in the options.

The default template files can be found in the `templates` directory of the swagger-to-ts package.

### CLI

swagger-to-ts also provides a command-line interface (CLI) to generate TypeScript code. You can install the CLI globally using npm:

```shell
npm install -g @infinite-debugger/swagger-to-ts
```

Certainly! The swagger-to-ts command-line interface (CLI) allows you to generate TypeScript code directly from your terminal. Here's how you can use it:

```shell
swagger-to-ts [options] -f <specPath> -o <outputPath>
```

Replace `<specPath>` with the path to your Swagger or OpenAPI specification file, and `<outputPath>` with the directory where you want to generate the TypeScript code.

#### Options

The swagger-to-ts CLI supports the following options:

- `-o, --output <directory>`: Specifies the output directory for the generated TypeScript code. If not provided, the code will be generated in the current directory.
- `-f, --file <file>`: Specifies the Swagger document or OpenAPI specification file to use for generating the TypeScript code. If not provided, the application will look for a file named swagger.json in the current directory.
- `-h, --help`: Displays the help text and usage instructions for the command line application.
- `-v, --version`: Displays the version information of the swagger-to-ts command line application.

#### Examples

Here are a few examples demonstrating the usage of the swagger-to-ts CLI:

```shell
swagger-to-ts -f /path/to/swagger.json -o /path/to/output
```

Generate TypeScript code from the Swagger file located at `/path/to/swagger.json` and output the generated code to the directory `/path/to/output`.

That's it! You can now use the swagger-to-ts CLI to generate TypeScript code from your Swagger or OpenAPI specifications with ease.
