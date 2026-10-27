import js from '@eslint/js';
import globals from 'globals';

// Rules that keep the code easy to read and review.
const style = {
  eqeqeq: ['error', 'always'],
  'prefer-const': 'error',
  'no-var': 'error',
  curly: ['error', 'multi-line'],
  'no-else-return': 'error',
  'no-shadow': 'error',
  'no-nested-ternary': 'error',
  'max-params': ['error', 5],
};

// Application code must stay in small, single-purpose functions (tests are exempt: a test file is one big describe).
const small = { 'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }] };

export default [
  { ignores: ['node_modules/', 'coverage/', 'demo-video/'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'api/**/*.js', 'test/**/*.js', 'testing/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
    rules: style,
  },
  {
    files: ['server/**/*.js', 'api/**/*.js'],
    rules: small,
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser },
    rules: { ...style, ...small },
  },
];
