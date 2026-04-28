import {config as appBaseConfig} from '@app/eslint-config';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['build/**', 'coverage/**', 'dist/**', 'node_modules/**'],
  },
  ...appBaseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Match former .eslintrc.cjs relaxations for this codebase
      '@typescript-eslint/no-loss-of-precision': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/member-delimiter-style': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',

      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-misused-promises': 'off',

      '@typescript-eslint/no-unused-vars': ['error', {args: 'none'}],
      '@typescript-eslint/consistent-type-imports': 'off',

      // Repo does not enforce shared config import/order + unicorn stylistic prefs yet (like web exemptions)
      'import/order': 'off',
      'import/extensions': 'off',
      'no-console': 'off',
      'no-loss-of-precision': 'off',
      curly: 'off',

      'unicorn/catch-error-name': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/prefer-includes': 'off',
      'unicorn/prefer-optional-catch-binding': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/better-regex': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-lonely-if': 'off',
      'unicorn/no-for-loop': 'off',

      'sonarjs/prefer-immediate-return': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-collapsible-if': 'off',

      'no-useless-catch': 'off',
      'no-empty': 'off',
      'max-len': 'off',

      // Match web: kebab filenames are not universal in historical Node services
      'unicorn/filename-case': 'off',
      'unicorn/no-nested-ternary': 'off',
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
