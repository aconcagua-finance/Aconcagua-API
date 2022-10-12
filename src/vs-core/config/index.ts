import { readFileSync, existsSync } from 'fs';

import { parse } from 'dotenv';
import { readFile } from 'fs-extra';

// import memoizeOne from 'memoize-one';

// const memoizeOne = require('memoize-one');

// export const getEnvConfig = memoizeOne((key: string) => {
//   return process.env[key];
// });
//

const loadDotEnvSync = () => {
  const FILE_NAME_ENV = '.env';

  // const envFilePath = resolve(resolveStagePath(options), FILE_NAME_ENV)
  const envFilePath = FILE_NAME_ENV;

  if (!existsSync(envFilePath)) return {};

  const data = readFileSync(envFilePath);

  return parse(data);
};

const loadDotEnv = async () => {
  const FILE_NAME_ENV = '.env';

  // const envFilePath = resolve(resolveStagePath(options), FILE_NAME_ENV)
  const envFilePath = FILE_NAME_ENV;

  const data = await readFile(envFilePath, 'utf8');
  return parse(data);
};

const updateEnv = (env: any) => {
  if (env) {
    process.env = {
      ...process.env,
      ...env,
    };
  }

  return process.env;
};

export const getEnvConfig = (key: string) => {
  return process.env[key];
};

export const loadConfig = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const dotEnvData = await loadDotEnv();

    updateEnv(dotEnvData);
  }
};

export const loadConfigSync = () => {
  const dotEnvData = loadDotEnvSync();

  updateEnv(dotEnvData);
};
