import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // 暫時關閉，避免其他套件的 TypeScript 錯誤影響編譯
  clean: true,
  sourcemap: true,
  splitting: false,
  external: [
    '@specpilot/shared',
    '@specpilot/spec-loader',
    '@specpilot/flow-parser',
    '@specpilot/schemas',
  ],
});
