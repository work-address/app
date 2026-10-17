import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const directory = mkdtempSync(join(tmpdir(), 'wa-pack-smoke-'))
const run = (command, args, cwd = process.cwd()) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(directory, 'npm-cache') },
  })
try {
  const names = [
    'agent-tracking-contract',
    'agent-tracker',
    'agent-tracker-openclaw',
  ]
  for (const name of names)
    run('pnpm', [
      '--dir',
      `packages/${name}`,
      'pack',
      '--pack-destination',
      directory,
    ])
  // Pack the already-installed dependency so the smoke test needs no registry access.
  const require = createRequire(
    resolve('packages/agent-tracking-contract/package.json'),
  )
  run('npm', [
    'pack',
    dirname(require.resolve('zod/package.json')),
    '--pack-destination',
    directory,
    '--ignore-scripts',
    '--silent',
  ])
  const tarballs = readdirSync(directory)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(directory, name))
  run('npm', [
    'install',
    '--prefix',
    directory,
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...tarballs,
  ])
  const pluginManifest = JSON.parse(
    readFileSync(
      join(
        directory,
        'node_modules/@work-address/agent-tracker-openclaw/openclaw.plugin.json',
      ),
    ),
  )
  if (pluginManifest.id !== 'work-address-agent-tracker')
    throw new Error('Missing plugin manifest')
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { parseEvent } from '@work-address/agent-tracking-contract';
    import { EventQueue, captureHook, CodexExecAdapter, emitEvent } from '@work-address/agent-tracker';
    import { OpenClawAdapter } from '@work-address/agent-tracker-openclaw';
    if (![parseEvent, EventQueue, OpenClawAdapter, captureHook, CodexExecAdapter, emitEvent].every(x => typeof x === 'function')) throw Error('Invalid exports');
  `,
    ],
    directory,
  )
  for (const file of [
    'hermes/pyproject.toml',
    'hermes/work_address_hermes/__init__.py',
    'opencode/work-address.mjs',
    'hooks/claude-code.json',
    'hooks/codex.json',
    'hooks/kimi-code.toml',
  ])
    readFileSync(
      join(directory, 'node_modules/@work-address/agent-tracker/bridges', file),
    )
  run(
    process.execPath,
    [
      join(directory, 'node_modules/@work-address/agent-tracker/dist/cli.js'),
      '--help',
    ],
    directory,
  )
  console.log(
    'PASS: all three npm tarballs install and load outside the workspace; CLI and manifest present.',
  )
} finally {
  rmSync(directory, { recursive: true, force: true })
}
