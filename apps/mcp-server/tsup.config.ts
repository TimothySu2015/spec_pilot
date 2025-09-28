import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  sourcemap: false,
  clean: true,
  splitting: false,
  outDir: 'dist',
  target: 'node18',
  platform: 'node',
  treeshake: false,
  minify: false,
  bundle: true,
  skipNodeModulesBundle: false,
  external: [
    // 只保留 Node.js 內建模組為外部依賴
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
    'worker_threads',
    'module',
    'net',
    'tls',
    'dns',
    'zlib',
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '#!/usr/bin/env node',
    };
    options.mainFields = ['main', 'module'];
    options.conditions = ['node'];
  },
});