module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  parser: 'babel-eslint',
  plugins: ['react', 'react-native', 'flowtype'],
  extends: [
    'eslint:recommended',
    'plugin:flowtype/recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
  ],
  parserOptions: {
    sourceType: 'module',
  },
  rules: {
    indent: ['error', 2, { SwitchCase: 1 }],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-var': 'error',

    'flowtype/generic-spacing': 'off',
  },
};
