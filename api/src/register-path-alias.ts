import path from 'path'

/** Node's internal `_resolveFilename` style (minimal typing). */
type ResolveFilenameFn = (
  request: string,
  parent?: unknown,
  isMain?: boolean,
  options?: unknown,
) => string

const builtins = require('module') as { _resolveFilename: ResolveFilenameFn }

/** Map `@/` to this directory (`src/` in dev via ts-node, `build/` after tsc). */
const rootDir = path.join(__dirname)

const builtinResolveFilename = builtins._resolveFilename

builtins._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(rootDir, request.slice(2))
  }
  return builtinResolveFilename.call(this, request, parent, isMain, options)
}
