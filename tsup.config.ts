import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'apps/cli/src/index.ts',
    'apps/mcp-server/src/index.ts',
    'packages/config/src/index.ts',
    'packages/shared/src/index.ts', 
    'packages/testing/src/index.ts',
    'packages/core-flow/src/index.ts',
    'packages/spec-loader/src/index.ts',
    'packages/flow-parser/src/index.ts',
    'packages/http-runner/src/index.ts',
    'packages/validation/src/index.ts',
    'packages/reporting/src/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: false, // 暫時停用以避免建置問題
  sourcemap: true,
  clean: true,
  splitting: false,
  outDir: 'dist',
  target: 'es2022',
  platform: 'node',
  treeshake: true,
  minify: false,
  skipNodeModulesBundle: true,
  external: [
    // Node.js built-in modules
    'fs',
    'path',
    'url',
    'util',
    'stream',
    'events',
    'crypto',
    'http',
    'https',
    'os',
    'child_process',
  ],
});