// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format

import { config as appBaseConfig, reactConfig } from '@app/eslint-config'
import reactRefresh from 'eslint-plugin-react-refresh'
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // storybook-static contains large bundled JS; linting it looks like a hang.
    ignores: [
      'dist/**',
      'storybook-static/**',
      'coverage/**',
      'src/shared/api/generated',
    ],
  },
  ...appBaseConfig,
  ...reactConfig,
  {
    rules: {
      'import/extensions': 'off',
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            kebabCase: true,
            pascalCase: false,
            camelCase: false,
          },
        },
      ],
      'unicorn/no-nested-ternary': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  storybook.configs['flat/recommended'],
)
