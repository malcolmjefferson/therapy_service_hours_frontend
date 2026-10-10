// ESLint flat config (docs/standards/02-react-coding-standards.md §11).
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// FE-60: no HTML injection or dynamic code paths.
const bannedSyntax = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'FE-60: render user content as text only.',
  },
  { selector: "MemberExpression[property.name='innerHTML']", message: 'FE-60: innerHTML is banned.' },
  { selector: "MemberExpression[property.name='outerHTML']", message: 'FE-60: outerHTML is banned.' },
  { selector: "CallExpression[callee.name='eval']", message: 'FE-60: eval is banned.' },
  { selector: "NewExpression[callee.name='Function']", message: 'FE-60: new Function is banned.' },
];

// FE-02: shared code never depends on features or the app shell.
const sharedMayNotImport = {
  patterns: [
    {
      group: ['**/features/**', '**/app/**'],
      message: 'FE-02: src/components and src/lib must not import features or app.',
    },
  ],
};

// FE-01: other code reaches a feature only through its index.ts.
const featureInternals = {
  patterns: [
    {
      group: ['**/features/*/*', '!**/features/*/index', '!**/features/*/index.ts'],
      message: 'FE-01: import a feature through its index.ts, not its internals.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'src/lib/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.configs.strict.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-syntax': ['error', ...bannedSyntax],
      'no-restricted-imports': ['error', featureInternals],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],
      'react/no-danger': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/components/**', 'src/lib/**', 'src/theme/**'],
    rules: { 'no-restricted-imports': ['error', sharedMayNotImport] },
  },
  {
    // A feature's own files may import each other freely.
    files: ['src/features/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['*.js', '*.mjs', 'scripts/**/*.mjs', 'e2e/**/*.mjs', '*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { ...tseslint.configs.disableTypeChecked.languageOptions, globals: { ...globals.node } },
  },
  {
    // Command-line scripts report to the terminal.
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
);
