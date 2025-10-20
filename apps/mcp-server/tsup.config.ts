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

  // 強制打包所有 workspace 內部套件
  noExternal: [
    /@specpilot\/.*/,  // 所有 @specpilot/* 套件
  ],

  // 只保留 Node.js 內建模組與外部 npm 套件為外部依賴
  external: [
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
    '@faker-js/faker',  // 外部依賴：測試資料產生器
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '#!/usr/bin/env node',
    };
    options.mainFields = ['main', 'module'];
    options.conditions = ['node'];
  },
});