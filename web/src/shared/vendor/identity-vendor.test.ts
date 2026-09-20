import { describe, expect, it } from 'vitest'

/**
 * The browser's copy of @work-address/identity must stay byte-identical to
 * the API's, which `api/src/test/service/identity-library.test.ts` pins to
 * the published schema v1 vectors. Two copies that drift would compute two
 * different commitments, and only one of them would be the one on chain.
 *
 * The single documented exception is `verify-document.ts`: the browser does
 * not verify documents, and that file is the only one using a TypeScript
 * parameter property, which `erasableSyntaxOnly` forbids here. It is left
 * out, so `index.ts` drops exactly its export line and nothing else.
 *
 * The sources are read with `import.meta.glob`, not `node:fs`: this project
 * builds through `vite-plugin-node-polyfills`, whose `fs` shim answers every
 * call with a stub, so a test that opened the files itself would pass
 * without ever comparing them.
 */
const OMITTED = 'verify-document.ts'
const OMITTED_EXPORT = "export * from './verify-document'\n"

const basenames = (sources: Record<string, string>): string[] =>
  Object.keys(sources)
    .map((path) => path.slice(path.lastIndexOf('/') + 1))
    .sort()

const byName = (sources: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(sources).map(([path, text]) => [
      path.slice(path.lastIndexOf('/') + 1),
      text,
    ]),
  )

const WEB = byName(
  import.meta.glob('./identity/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)

const API = byName(
  import.meta.glob('../../../../api/src/vendor/identity/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)

describe('the browser copy of @work-address/identity', () => {
  it('reads both copies rather than an empty directory', () => {
    expect(basenames(WEB).length).toBeGreaterThan(10)
    expect(basenames(API).length).toBeGreaterThan(10)
  })

  it('holds every file the API holds but the one it documents leaving out', () => {
    expect(basenames(WEB)).toEqual(
      basenames(API).filter((file) => file !== OMITTED),
    )
    expect(basenames(API)).toContain(OMITTED)
  })

  it.each(basenames(WEB).filter((file) => file !== 'index.ts'))(
    '%s is byte-identical to the API copy',
    (file) => {
      expect(WEB[file]).toBe(API[file])
    },
  )

  it('differs from the API index.ts by exactly the omitted export', () => {
    expect(API['index.ts']).toContain(OMITTED_EXPORT)
    expect(WEB['index.ts']).toBe(API['index.ts'].replace(OMITTED_EXPORT, ''))
  })
})
