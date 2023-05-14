#!/usr/bin/env node

import { join, normalize } from 'path';

import { existsSync } from 'fs-extra';

import { generateTypescriptAPI } from './api';

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

if (args.includes('-G') || args.includes('--generate')) {
  const openAPISpecificationFilePath = `${currentWorkingDirectory}/swagger.json`;

  if (existsSync(openAPISpecificationFilePath)) {
    const openAPISpecification = require(openAPISpecificationFilePath);

    const outputRootPath = (() => {
      if (args.includes('-o')) {
        const argsPath = args[args.indexOf('-o') + 1];
        if (argsPath) {
          return normalize(join(currentWorkingDirectory, argsPath));
        }
      }
      return currentWorkingDirectory;
    })();

    generateTypescriptAPI({
      openAPISpecification,
      outputRootPath,
    });
  } else {
    console.log('API configuration file not found. Exiting...');
  }
} else {
  console.log(`${pkg.name} v${pkg.version}`);
}
