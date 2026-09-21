#!/usr/bin/env node
/*
 * Copies this library, byte for byte, into another repository that cannot
 * depend on it: the marketplace website builds from its own repository and
 * Docker context, so it carries a copy (web/packages/identity) instead.
 *
 *   node contracts/packages/identity/scripts/vendor.cjs ../web/packages/identity
 *
 * Writes <target>/src/*.ts, <target>/test/fixtures/profile-schema-v1.vectors.json
 * and <target>/SOURCE.json: the commit copied from and the SHA-256 of every
 * file, which the target's own suite holds its copy to. A copy edited by
 * hand, or half updated, then fails there instead of computing something
 * the chain does not.
 *
 * Refuses to run over uncommitted changes to src/, because the commit it
 * records would not be what it copied.
 */
const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const vectors = path.join(root, '../../test/fixtures/profile-schema-v1.vectors.json')
const target = process.argv[2] && path.resolve(process.argv[2])

if (!target) {
  console.error('Usage: vendor.cjs <target directory>')
  process.exit(2)
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

if (git('status', '--porcelain', '--', 'src', vectors) !== '') {
  console.error('src/ or the vectors have uncommitted changes: commit them first, so the recorded commit is what was copied.')
  process.exit(1)
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const files = {}

fs.rmSync(path.join(target, 'src'), { recursive: true, force: true })
fs.mkdirSync(path.join(target, 'src'), { recursive: true })
fs.mkdirSync(path.join(target, 'test/fixtures'), { recursive: true })

for (const name of fs.readdirSync(path.join(root, 'src')).sort()) {
  if (!name.endsWith('.ts')) continue

  fs.copyFileSync(path.join(root, 'src', name), path.join(target, 'src', name))
  files[`src/${name}`] = sha256(path.join(target, 'src', name))
}

fs.copyFileSync(vectors, path.join(target, 'test/fixtures/profile-schema-v1.vectors.json'))
files['test/fixtures/profile-schema-v1.vectors.json'] = sha256(vectors)

fs.writeFileSync(
  path.join(target, 'SOURCE.json'),
  `${JSON.stringify({ repository: 'work-address/app', path: 'contracts/packages/identity', commit: git('rev-parse', 'HEAD'), files }, null, 2)}\n`,
)

console.log(`Copied ${Object.keys(files).length} files to ${target}`)
