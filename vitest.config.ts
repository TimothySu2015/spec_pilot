import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts', 'apps/**/__tests__/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/*.ts', 'apps/**/*.ts'],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/vitest.config.ts',
        '**/tsup.config.ts',
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        'packages/config/src/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
        'packages/shared/src/**': {
          lines: 80,
          functions: 70,
          branches: 80,
          statements: 80,
        },
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@specpilot/core-flow': path.resolve(__dirname, 'packages/core-flow/src'),
      '@specpilot/config': path.resolve(__dirname, 'packages/config/src'),
      '@specpilot/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@specpilot/testing': path.resolve(__dirname, 'packages/testing/src'),
      '@specpilot/spec-loader': path.resolve(__dirname, 'packages/spec-loader/src'),
      '@specpilot/flow-parser': path.resolve(__dirname, 'packages/flow-parser/src'),
      '@specpilot/http-runner': path.resolve(__dirname, 'packages/http-runner/src'),
      '@specpilot/validation': path.resolve(__dirname, 'packages/validation/src'),
      '@specpilot/schemas': path.resolve(__dirname, 'packages/schemas/src'),
      '@specpilot/reporting': path.resolve(__dirname, 'packages/reporting/src'),
      '@specpilot/flow-generator': path.resolve(__dirname, 'packages/flow-generator/src'),
      '@specpilot/test-suite-generator': path.resolve(__dirname, 'packages/test-suite-generator/src'),
      '@specpilot/flow-validator': path.resolve(__dirname, 'packages/flow-validator/src'),
    },
  },
});

