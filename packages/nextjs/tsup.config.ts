import type { Options } from 'tsup';
import { defineConfig } from 'tsup';

// @ts-ignore
import { name, version } from './package.json';

export default defineConfig(overrideOptions => {
  const isProd = overrideOptions.env?.NODE_ENV === 'production';

  const common: Options = {
    entry: ['./src/**/*.{ts,tsx,js,jsx}'],
    // We want to preserve original file structure
    // so that the "use client" directives are not lost
    // and make debugging easier via node_modules easier
    bundle: false,
    clean: true,
    minify: false,
    sourcemap: true,
    legacyOutput: true,
    define: {
      PACKAGE_NAME: `"${name}"`,
      PACKAGE_VERSION: `"${version}"`,
      __DEV__: `${!isProd}`,
    },
  };

  const esm: Options = {
    ...common,
    format: 'esm',
    onSuccess: 'cp ./package.esm.json ./dist/esm/package.json && npm run build:declarations',
  };

  const cjs: Options = {
    ...common,
    format: 'cjs',
    outDir: './dist/cjs',
    onSuccess: 'cp ./package.cjs.json ./dist/cjs/package.json && npm run build:declarations',
  };

  return [esm, cjs];
});
