import { suite, test, timeout } from '@testdeck/mocha'
import { expect } from 'chai'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const API_ROOT = path.join(__dirname, '../../..')

/**
 * A regenerated spec is diffed against the committed one to catch a client
 * left behind by an API change, and that check only means something when
 * exporting the same code twice gives the same bytes. Examples used to be
 * drawn from faker and the clock, so every export differed from the last.
 *
 * Each export is its own process, as `pnpm run export-openapi` is: example
 * values are fixed when the decorators run at import, so two exports inside
 * one process would match whatever they drew.
 */
@suite()
export class ExportOpenApiSpecTest {
  private export(output: string): Buffer {
    // Through `env -u NODE_OPTIONS`: under `pnpm test` nyc preloads itself
    // into every child through NODE_OPTIONS, re-adding it whatever env is
    // passed here, and a child transpiled apart from the suite would merge a
    // second, mismatched map of every file it loads into the coverage report.
    // Uninstrumented, the export runs as the pnpm script runs it.
    execFileSync(
      'env',
      [
        '-u',
        'NODE_OPTIONS',
        process.execPath,
        '-r',
        'tsconfig-paths/register',
        '-r',
        'ts-node/register',
        'src/scripts/export-openapi-spec.ts',
        output,
      ],
      {
        cwd: API_ROOT,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TS_NODE_PROJECT: 'tsconfig.json',
          TS_NODE_TRANSPILE_ONLY: '1',
        },
        stdio: 'pipe',
      },
    )

    return fs.readFileSync(output)
  }

  @test()
  @timeout(120000)
  twoExports_areByteIdentical() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-export-'))

    try {
      const first = this.export(path.join(dir, 'first.json'))
      const second = this.export(path.join(dir, 'second.json'))

      // Guard the premise: a real spec, not two empty files.
      expect(JSON.parse(first.toString('utf8')).paths).to.have.property(
        '/api/invoice/{id}/record',
      )
      expect(second.toString('utf8')).to.equal(first.toString('utf8'))
      expect(second.equals(first), 'byte for byte').to.be.true
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}
