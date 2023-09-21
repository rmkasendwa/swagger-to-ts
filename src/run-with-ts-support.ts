#!/usr/bin/env node

import { join, normalize } from 'path';

import { existsSync } from 'fs-extra';

import {
  GenerateTypescriptAPIOptions,
  RequestOperationNameSourceValidationSchema,
  generateTypescriptAPI,
} from './api';
import { getHelpText } from './api/Utils';

const currentWorkingDirectory = process.cwd();

const pkg = (() => {
  if (existsSync(`${__dirname}/package.json`)) {
    return require(`${__dirname}/package.json`);
  }
  const pkgPath = join(__dirname, '..', 'package.json');
  if (existsSync(pkgPath)) {
    return require(pkgPath);
  }
})();

const args = process.argv;

if (args.includes('-v') || args.includes('--version')) {
  console.log(pkg.version);
} else if (args.includes('-h') || args.includes('--help')) {
  console.log(getHelpText());
} else {
  const openAPISpecificationFilePath = (() => {
    if (args.includes('-f') || args.includes('--file')) {
      const inputFilePath = (() => {
        if (args.includes('-f')) {
          return args[args.indexOf('-f') + 1];
        }
        if (args.includes('--file')) {
          return args[args.indexOf('--file') + 1];
        }
      })();
      if (inputFilePath) {
        return normalize(join(currentWorkingDirectory, inputFilePath));
      }
    }
    return `${currentWorkingDirectory}/swagger`;
  })();

  if (
    ['.json', '.js', '.ts'].some(
      (fileExtension) =>
        existsSync(openAPISpecificationFilePath + fileExtension) ||
        existsSync(openAPISpecificationFilePath + '/index' + fileExtension)
    )
  ) {
    const openAPISpecification = require(openAPISpecificationFilePath);

    const outputRootPath = (() => {
      if (args.includes('-o') || args.includes('--output')) {
        const outputDirectoryPath = (() => {
          if (args.includes('-o')) {
            return args[args.indexOf('-o') + 1];
          }
          if (args.includes('--output')) {
            return args[args.indexOf('--output') + 1];
          }
        })();
        if (outputDirectoryPath) {
          return normalize(join(currentWorkingDirectory, outputDirectoryPath));
        }
      }
      return currentWorkingDirectory;
    })();

    const options: Partial<GenerateTypescriptAPIOptions> = {
      ...(() => {
        if (args.includes('-wIS') || args.includes('--write-internal-state')) {
          return {
            writeInternalState: true,
          };
        }
      })(),
      ...(() => {
        if (
          args.includes('-rONS') ||
          args.includes('--request-operation-name-source')
        ) {
          try {
            const inputRequestOperationNameSource = (() => {
              if (args.includes('-rONS')) {
                return args[args.indexOf('-rONS') + 1];
              }
              if (args.includes('--request-operation-name-source')) {
                return args[
                  args.indexOf('--request-operation-name-source') + 1
                ];
              }
            })();
            if (
              inputRequestOperationNameSource &&
              !inputRequestOperationNameSource.match(/^-/g)
            ) {
              const requestOperationNameSource =
                RequestOperationNameSourceValidationSchema.parse(
                  inputRequestOperationNameSource
                );
              return {
                requestOperationNameSource,
              };
            }
          } catch (err) {
            err;
          }
        }
      })(),
      ...(() => {
        if (
          args.includes('-gTC') ||
          args.includes('--generate-tsed-controllers')
        ) {
          return {
            generateTsEDControllers: true,
          };
        }
      })(),
      ...(() => {
        if (
          args.includes('-tADIP') ||
          args.includes('--tsed-authenticate-decorator-import-path')
        ) {
          const tsEDAuthenticateDecoratorImportPath = (() => {
            if (args.includes('-tADIP')) {
              return args[args.indexOf('-tADIP') + 1];
            }
            if (args.includes('--tsed-authenticate-decorator-import-path')) {
              return args[
                args.indexOf('--tsed-authenticate-decorator-import-path') + 1
              ];
            }
          })();
          if (
            tsEDAuthenticateDecoratorImportPath &&
            !tsEDAuthenticateDecoratorImportPath.match(/^-/g)
          ) {
            return {
              tsEDAuthenticateDecoratorImportPath,
            };
          }
        }
      })(),
      ...(() => {
        if (
          args.includes('-tCNP') ||
          args.includes('--tsed-controller-name-prefix')
        ) {
          const tsedControllerNamePrefix = (() => {
            if (args.includes('-tCNP')) {
              return args[args.indexOf('-tCNP') + 1];
            }
            if (args.includes('--tsed-controller-name-prefix')) {
              return args[args.indexOf('--tsed-controller-name-prefix') + 1];
            }
          })();
          if (
            tsedControllerNamePrefix &&
            !tsedControllerNamePrefix.match(/^-/g)
          ) {
            return {
              tsedControllerNamePrefix,
            };
          }
        }
      })(),
      ...(() => {
        if (
          args.includes('-tCNS') ||
          args.includes('--tsed-controller-name-suffix')
        ) {
          const tsedControllerNameSuffix = (() => {
            if (args.includes('-tCNS')) {
              return args[args.indexOf('-tCNS') + 1];
            }
            if (args.includes('--tsed-controller-name-suffix')) {
              return args[args.indexOf('--tsed-controller-name-suffix') + 1];
            }
          })();
          if (
            tsedControllerNameSuffix &&
            !tsedControllerNameSuffix.match(/^-/g)
          ) {
            return {
              tsedControllerNameSuffix,
            };
          }
        }
      })(),
      ...(() => {
        if (
          args.includes('-niTFVS') ||
          args.includes('--no-infer-type-from-validation-schema')
        ) {
          return {
            inferTypeFromValidationSchema: false,
          };
        }
      })(),
      ...(() => {
        if (args.includes('-sN') || args.includes('--scope-name')) {
          const scopeName = (() => {
            if (args.includes('-sN')) {
              return args[args.indexOf('-sN') + 1];
            }
            if (args.includes('--scope-name')) {
              return args[args.indexOf('--scope-name') + 1];
            }
          })();
          if (scopeName && !scopeName.match(/^-/g)) {
            return {
              scopeName,
            };
          }
        }
      })(),
    };

    generateTypescriptAPI({
      openAPISpecification,
      outputRootPath,
      ...options,
    });
  } else {
    console.log(`The file ${openAPISpecificationFilePath} does not exist.`);
  }
}
