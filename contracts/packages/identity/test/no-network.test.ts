import { expect } from 'chai'
import { ed25519 } from '@noble/curves/ed25519'
import { Wallet, encodeBase58, hexlify } from 'ethers'
import dgram from 'node:dgram'
import dns from 'node:dns'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import tls from 'node:tls'

import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  createSelfSignedPresentation,
  evmSubject,
  profileCommitment,
  profileFieldsFromAppUser,
  restoreProfileTree,
  selfSignedMessageFor,
  serializeDocument,
  solanaSubject,
  verifyOrigin,
  verifyPresentation,
  verifyPresentationDocument,
} from '../src'

import { clone, fixture } from './fixture'
import { scriptedRpc } from './scripted-rpc'

/**
 * The library is pure computation: it never reaches a network, so a holder
 * can build, present and check a profile offline, and a verifier's RPC call
 * to the registry is always the caller's own, visible choice. Every way Node
 * and the browser globals open a connection is trapped while the whole
 * lifecycle runs, and the source is checked for anything that could.
 *
 * The chain-aware verifier keeps the same promise one step out: it asks
 * through the `RpcRequest` it is handed and through nothing else. `rpc.ts`
 * holds the one transport in the package, and it is the only file allowed to
 * name a network API at all.
 */

type Trap = { target: Record<string, unknown>; key: string; original: unknown }

const SOURCE_DIR = path.join(__dirname, '../src')

/** What `src/` may import: its own files, ethers' hashing and ABI code, and noble's Ed25519. */
const ALLOWED_IMPORTS = new Set(['ethers', '@noble/curves/ed25519'])

/** The JSON-RPC transport: the one file that may name the Fetch API, and it names nothing else. */
const TRANSPORT = 'rpc.ts'

describe('no network calls', () => {
  const attempts: string[] = []
  const traps: Trap[] = []

  function trap(target: object, key: string, label: string) {
    const record = target as Record<string, unknown>

    traps.push({ target: record, key, original: record[key] })
    record[key] = function trapped() {
      attempts.push(label)
      throw new Error(`network call attempted: ${label}`)
    }
  }

  before(() => {
    trap(globalThis, 'fetch', 'fetch')
    trap(globalThis, 'WebSocket', 'WebSocket')
    trap(globalThis, 'XMLHttpRequest', 'XMLHttpRequest')
    trap(globalThis, 'EventSource', 'EventSource')
    trap(net.Socket.prototype, 'connect', 'net.Socket#connect')
    trap(net, 'connect', 'net.connect')
    trap(net, 'createConnection', 'net.createConnection')
    trap(tls, 'connect', 'tls.connect')
    trap(http, 'request', 'http.request')
    trap(http, 'get', 'http.get')
    trap(https, 'request', 'https.request')
    trap(https, 'get', 'https.get')
    trap(dns, 'lookup', 'dns.lookup')
    trap(dns, 'resolve', 'dns.resolve')
    trap(dns.promises, 'lookup', 'dns.promises.lookup')
    trap(dgram, 'createSocket', 'dgram.createSocket')
  })

  after(() => {
    for (const { target, key, original } of traps.reverse()) {
      if (original === undefined) delete target[key]
      else target[key] = original
    }
  })

  it('traps a connection attempt, so the check below can fail', () => {
    expect(() => http.request('http://127.0.0.1:9')).to.throw('network call attempted')
    expect(attempts).to.deep.eq(['http.request'])
    attempts.length = 0
  })

  it('builds, exports, restores, presents and verifies, anchored and self-signed, without opening one', async () => {
    const { fields } = profileFieldsFromAppUser(fixture.cases[0].source)

    const wallet = Wallet.createRandom()
    const tree = buildProfileTree({ subject: evmSubject(wallet.address, fixture.chainId), fields })

    profileCommitment({ chainId: fixture.chainId, registry: fixture.registry, subject: wallet.address, schemaId: 1, root: tree.root })
    restoreProfileTree(serializeDocument(createProfileExport(tree)))

    const anchored = createAnchoredPresentation(tree, {
      disclose: ['name', 'rate'],
      anchor: { chainId: fixture.chainId, registry: fixture.registry, version: 1 },
    })
    const tampered = clone(anchored)

    tampered.disclosures[0].value = 'Someone else'

    const selfSignedEvm = createSelfSignedPresentation(tree, {
      disclose: ['skills'],
      signature: await wallet.signMessage(selfSignedMessageFor(tree)),
    })

    const secret = ed25519.utils.randomPrivateKey()
    const solanaTree = buildProfileTree({ subject: solanaSubject(encodeBase58(ed25519.getPublicKey(secret))), fields })
    const selfSignedSolana = createSelfSignedPresentation(solanaTree, {
      disclose: ['title'],
      signature: hexlify(ed25519.sign(new TextEncoder().encode(selfSignedMessageFor(solanaTree)), secret)),
    })

    const results = [anchored, selfSignedEvm, selfSignedSolana, tampered].map((document) =>
      verifyPresentationDocument(serializeDocument(document)).ok,
    )

    expect(results).to.deep.eq([true, true, true, false])
    expect(attempts, 'network calls').to.deep.eq([])
  })

  it('checks a presentation against a chain through the RpcRequest it is handed, and nothing else', async () => {
    const { rpc, asked } = scriptedRpc({})
    const report = await verifyPresentation(fixture.cases[0].presentation.text, {
      manifest: { chainId: fixture.chainId, identityRegistry: { address: fixture.registry } },
      rpc,
    })

    expect(report.result).to.eq('Current')
    expect(asked.length).to.be.greaterThan(0)
    expect(() => verifyOrigin({ contractId: 'x', version: 2, preimage: {}, termsHash: '0x', domain: { name: 'n', version: '1' }, types: {}, allocations: [] })).to.not.throw()
    expect(attempts, 'network calls').to.deep.eq([])
  })

  it('imports nothing that can reach a network, and uses no Node-only global', () => {
    const files = fs.readdirSync(SOURCE_DIR).filter((file) => file.endsWith('.ts'))

    expect(files.length).to.be.greaterThan(5)

    for (const file of files) {
      const source = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8')
      const specifiers = [...source.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1])

      for (const specifier of specifiers) {
        expect(specifier.startsWith('./') || ALLOWED_IMPORTS.has(specifier), `${file} imports ${specifier}`).to.eq(true)
      }

      expect(source, file).to.not.match(/\brequire\s*\(|\bimport\s*\(/)
      expect(source, file).to.not.match(
        /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|JsonRpcProvider|getDefaultProvider|BrowserProvider|Provider|Contract)\b/,
      )
      expect(source, file).to.not.match(/\b(Buffer|process|__dirname|global)\b/)

      if (file !== TRANSPORT) expect(source, file).to.not.match(/\bfetch\b/)
    }

    expect(files).to.include(TRANSPORT)
  })

  it('keeps the transport to one endpoint: the URL it was given, by POST, with no credentials', () => {
    const source = fs.readFileSync(path.join(SOURCE_DIR, TRANSPORT), 'utf8')

    expect(source).to.not.match(/https?:\/\//)
    expect(source).to.not.match(/address\.work/i)
    expect(source.match(/\bsend\(/g), 'one call site').to.have.length(1)
    expect(source).to.match(/send\(url,/)
    expect(source).to.match(/credentials: 'omit'/)
    expect(source).to.match(/redirect: 'error'/)
  })
})
