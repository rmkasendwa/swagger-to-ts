import { join } from 'path';

import { existsSync } from 'fs-extra';

export const pkg = ((): {
  name: string;
  version: string;
} => {
  if (existsSync(`${__dirname}/package.json`)) {
    return require(`${__dirname}/package.json`);
  }
  const pkgPath = join(__dirname, '..', 'package.json');
  if (existsSync(pkgPath)) {
    return require(pkgPath);
  }
  throw new Error('Could not find package.json');
})();
