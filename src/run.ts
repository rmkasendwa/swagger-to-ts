#!/usr/bin/env node

import { join, normalize } from 'path';

import { existsSync } from 'fs-extra';

import { generateTypescriptAPI } from './api';
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
    return `${currentWorkingDirectory}/swagger.json`;
  })();

  if (existsSync(openAPISpecificationFilePath)) {
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

    generateTypescriptAPI({
      openAPISpecification,
      outputRootPath,
    });
  } else {
    console.log(`The file ${openAPISpecificationFilePath} does not exist.`);
  }
}
