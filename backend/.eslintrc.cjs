/** ESLint — backend (TypeScript, strict but pragmatic). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: { node: true, es2022: true, jest: true },
  rules: {
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    'no-console': 'error',
    eqeqeq: ['error', 'smart'],
    curly: ['error', 'multi-line'],
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs', 'jest.config.js'],
};
