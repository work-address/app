/// <reference types="vitest/config" />
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'

const dirname =
  typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname

function resolveGitCommit(): string {
  const fromEnv = process.env.GIT_COMMIT ?? process.env.VITE_GIT_COMMIT
  if (fromEnv && fromEnv !== 'unknown') {
    return fromEnv.length > 7 ? fromEnv.slice(0, 7) : fromEnv
  }

  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const gitCommit = resolveGitCommit()
process.env.VITE_GIT_COMMIT_SUFFIX = gitCommit === 'unknown' ? 'n/a' : gitCommit

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(({ command, mode }) => {
  const isDevMode = command === 'serve' && mode === 'development'
  const babelPlugins: string[] = []

  if (isDevMode) {
    babelPlugins.push('effector/babel-plugin')
  }

  return {
    base: '/',
    plugins: [
      nodePolyfills(),
      react({
        babel: {
          plugins: babelPlugins,
        },
      }),
      svgr(),
    ],
    server: {
      host: true,
      port: 8000,
      strictPort: true,
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET ?? 'http://api:4000',
          changeOrigin: true,
          // Forward X-Forwarded-For/Proto/Host so the API can see the real client IP
          // instead of the vite/web container's docker network address.
          xfwd: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      // Ignore storybook-static build output (extra index.html files trigger dep scans).
      // Exclude src/scripts — Node-only codegen (e.g. @hey-api/openapi-ts) must not be pre-bundled.
      entries: [
        path.resolve(dirname, 'index.html'),
        path.resolve(dirname, 'src/**/*.{ts,tsx,js,jsx}'),
        `!${path.resolve(dirname, 'src/scripts/**')}`,
      ],
      exclude: ['@hey-api/openapi-ts'],
    },
    test: {
      projects: [
        {
          extends: true,
          plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
            }),
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            },
          },
        },
      ],
    },
  }
})
