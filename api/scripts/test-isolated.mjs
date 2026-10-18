import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:net'
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))
const server = createServer()
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
await new Promise((resolve) => server.close(resolve))
const directory = mkdtempSync(join(tmpdir(), 'wa-api-test-'))
let started = false
try {
  execFileSync(
    'initdb',
    [
      '-D',
      directory,
      '-U',
      'wa_test',
      '--auth=trust',
      '--no-locale',
      '-E',
      'UTF8',
    ],
    { stdio: 'pipe' },
  )
  execFileSync(
    'pg_ctl',
    [
      '-D',
      directory,
      '-l',
      join(directory, 'server.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -k ${directory}`,
      '-w',
      'start',
    ],
    { stdio: 'pipe' },
  )
  started = true
  execFileSync(
    'createdb',
    ['-h', '127.0.0.1', '-p', String(port), '-U', 'wa_test', 'wa_test'],
    { stdio: 'pipe' },
  )
  const child = spawn(
    'pnpm',
    [
      'exec',
      'mocha',
      '-r',
      'tsconfig-paths/register',
      '-r',
      'ts-node/register',
      ...(process.argv.length > 2
        ? process.argv.slice(2)
        : ['src/test/**/*.test.ts']),
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-experimental-strip-types`,
        NODE_ENV: 'test',
        TS_NODE_PROJECT: 'tsconfig.json',
        WA_TEST_DB_PORT: String(port),
      },
    },
  )
  process.exitCode = await new Promise((resolve) =>
    child.once('exit', (code) => resolve(code ?? 1)),
  )
} finally {
  if (started)
    execFileSync('pg_ctl', ['-D', directory, '-m', 'immediate', '-w', 'stop'], {
      stdio: 'pipe',
    })
  rmSync(directory, { recursive: true, force: true })
}
