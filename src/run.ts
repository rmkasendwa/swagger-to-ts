#!/usr/bin/env node

import { exec } from 'node:child_process';

const currentProcessArgs = process.argv.slice(2);

const { stdout, stderr } = exec(
  `ts-node ${__dirname}/run-with-ts-support ${currentProcessArgs
    .map((arg) => {
      if (arg.includes(' ')) {
        return `"${arg}"`;
      }
      return arg;
    })
    .join(' ')}`,
  (err) => {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }
  }
);
stdout?.on('data', (data) => process.stdout.write(data));
stderr?.on('data', (data) => process.stderr.write(data));
