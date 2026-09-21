/// <reference types="vitest/config" />
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'

import type { BrowserCommand } from 'vitest/node'

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

/**
 * Switches the test page between screen and print media, for tests of what
 * a saved PDF looks like. Only the browser can say how `@media print` lays a
 * page out, and only the provider - not the page - can switch it.
 */
const emulateMedia: BrowserCommand<[media: 'print' | 'screen']> = async (
  context,
  media,
) => {
  await context.page.emulateMedia({ media })
}

const gitCommit = resolveGitCommit()
process.env.VITE_GIT_COMMIT_SUFFIX = gitCommit === 'unknown' ? 'n/a' : gitCommit

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(({ command, mode }) => {
  const isDevMode = command === 'serve' && mode === 'development'
  // Pull VITE_* vars from .env/.env.local into process.env so the dev proxy
  // target below can be overridden per machine, not only via the shell.
  Object.assign(process.env, loadEnv(mode, dirname, 'VITE_'))
  const babelPlugins: (string | [string, Record<string, unknown>])[] = []

  if (isDevMode) {
    babelPlugins.push(
      'effector/babel-plugin',
      // Labels styled-components so React DevTools shows `auth-layout__Root`
      // instead of `styled.div`, and DOM classes carry the same name. The file
      // prefix is what separates them: `Root` alone is used 35 times.
      ['babel-plugin-styled-components', { displayName: true, fileName: true }],
    )
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
          test: {
            name: 'unit',
            // model/ code is framework-free by rule, so it needs no DOM and no
            // browser - keeping it a separate project means `--project unit`
            // runs without playwright installed.
            environment: 'node',
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            // Layout, which only a real browser can measure: a jsdom run
            // reports every width as zero, so a card that scrolled sideways
            // on a phone would pass. Kept out of `unit` because that project
            // must stay runnable without playwright installed.
            name: 'browser',
            include: ['src/**/*.browser-test.{ts,tsx}'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              commands: { emulateMedia },
              instances: [
                {
                  browser: 'chromium',
                  viewport: { width: 375, height: 812 },
                },
              ],
            },
          },
        },
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
