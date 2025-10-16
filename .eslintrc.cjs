module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // 禁止 console.log/console.error
    'no-console': 'error',
    // TypeScript 嚴格規則
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    // 命名規範
    '@typescript-eslint/naming-convention': [
      'error',
      {
        'selector': 'function',
        'format': ['camelCase']
      },
      {
        'selector': 'class',
        'format': ['PascalCase']
      },
      {
        'selector': 'interface',
        'format': ['PascalCase']
      }
    ]
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '*.cjs',
    '*.mjs',
    'reports/',
    'logs/',
    '**/__tests__/**',
    'tests/',
    '*.config.ts',
    'config/',
    '*.test.ts',
    '*.spec.ts',
    'examples/'
  ]
};