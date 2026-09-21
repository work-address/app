import { expect } from 'chai'
import fs from 'node:fs'
import path from 'node:path'

import {
  CHAIN_RESULTS,
  ManifestError,
  RpcUnavailableError,
  isWithdrawn,
  jsonRpcTransport,
  readManifest,
  registryDeployment,
  verifyPresentation,
} from '../src'

import { fixture } from './fixture'
import { scriptedRpc } from './scripted-rpc'

import type { FetchLike } from '../src'

/**
 * The verifier's own decisions: how each reply from a chain, and each way a
 * reply can fail to come, becomes a result. The anchored vector is published
 * nowhere, so every chain here is scripted; contracts/test/identity-verify
 * runs the same code against the deployed registry.
 */
const ANCHORED = fixture.cases[0].presentation.text
const MANIFEST = { chainId: fixture.chainId, deployBlock: 7, identityRegistry: { contract: 'IdentityRegistry', address: fixture.registry } }

describe('verifyPresentation', () => {
  it('names the chain results in the order IdentityRegistry declares them', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../contracts/IdentityRegistry.sol'), 'utf8')
    const declared = /enum Presentation \{([^}]*)\}/.exec(source)?.[1].split(',').map((name) => name.trim())

    expect(declared).to.deep.eq([...CHAIN_RESULTS])
  })

  it('maps every value the registry can return, and carries the withdrawal flag beside it', async () => {
    for (const [index, name] of CHAIN_RESULTS.entries()) {
      const report = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: scriptedRpc({ fallback: [index, false] }).rpc })

      expect(report.result, name).to.eq(name)
      expect(report.accepted, name).to.eq(name === 'Current')
      expect([report.checkedAtBlock, report.finalized], name).to.deep.eq([120, true])
    }

    const old = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: scriptedRpc({ fallback: [4, true] }).rpc })

    expect([old.result, old.subjectDeactivated, isWithdrawn(old)]).to.deep.eq(['Superseded', true, true])
  })

  it('reads the finalized block and the head by number, and accepts only an answer both give', async () => {
    const agreed = scriptedRpc({ latest: 130, finalized: 98 })
    const report = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: agreed.rpc })

    expect([report.result, report.checkedAtBlock, report.finalized]).to.deep.eq(['Current', 98, true])
    expect(agreed.asked.filter(({ method }) => method === 'eth_call').map(({ params }) => params[1])).to.deep.eq(['0x82', '0x62'])

    // Published after the finalized block: the head says Current, the finalized block does not yet.
    const pending = await verifyPresentation(ANCHORED, {
      manifest: MANIFEST,
      rpc: scriptedRpc({ latest: 130, finalized: 98, answers: { 98: [0, false], 130: [6, false] } }).rpc,
    })

    expect([pending.result, pending.accepted, pending.atFinalized?.result, pending.atLatest?.result]).to.deep.eq([
      'NotFinal',
      false,
      'Unpublished',
      'Current',
    ])

    // Withdrawn after the finalized block: never Current on the strength of the older answer.
    const withdrawing = await verifyPresentation(ANCHORED, {
      manifest: MANIFEST,
      rpc: scriptedRpc({ latest: 130, finalized: 98, answers: { 98: [6, false], 130: [5, true] } }).rpc,
    })

    expect([withdrawing.result, withdrawing.accepted, isWithdrawn(withdrawing)]).to.deep.eq(['NotFinal', false, true])
  })

  it('reports a node with no finalized tag as NotFinal unless the head alone was asked for', async () => {
    const report = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: scriptedRpc({ finalized: null }).rpc })

    expect([report.result, report.accepted, report.atLatest?.result, report.finalized]).to.deep.eq(['NotFinal', false, 'Current', false])

    const head = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: scriptedRpc({ finalized: null }).rpc, finality: 'latest' })

    expect([head.result, head.accepted, head.checkedAtBlock, head.finalized]).to.deep.eq(['Current', true, 120, false])
  })

  it('never turns an endpoint that cannot answer into a verdict on the document', async () => {
    const cases: [string, Parameters<typeof scriptedRpc>[0]][] = [
      ['another chain', { chainId: 1 }],
      ['no code at the registry', { rawCall: '0x' }],
      ['not the registry ABI', { rawCall: '0x1234' }],
      ['a result this verifier does not know', { fallback: [7, false] }],
    ]

    for (const [name, script] of cases) {
      const report = await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: scriptedRpc(script).rpc })

      expect(report.result, name).to.eq('RpcUnavailable')
      expect(report.accepted, name).to.eq(false)
      expect(report.disclosed.length, name).to.be.greaterThan(0)
    }

    const none = await verifyPresentation(ANCHORED, { manifest: MANIFEST })

    expect(none.result).to.eq('RpcUnavailable')
  })

  it('asks nothing of a chain the manifest does not list', async () => {
    const { rpc, asked } = scriptedRpc({})
    const otherChain = { ...MANIFEST, chainId: 1 }
    const otherRegistry = { ...MANIFEST, identityRegistry: { address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' } }

    for (const manifest of [otherChain, otherRegistry, undefined]) {
      expect((await verifyPresentation(ANCHORED, { manifest, rpc })).result).to.eq('RegistryNotInManifest')
    }

    expect(asked).to.deep.eq([])
  })

  it('reads a deployment manifest, a list of them, and refuses one it cannot read', () => {
    const deployed = {
      $schema: './manifest.schema.json',
      network: 'localhost',
      chainId: 31337,
      deployBlock: 1,
      deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      originSigner: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      token: { contract: 'TetherLikeUSDT', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', decimals: 6 },
      escrow: { contract: 'MarketplaceEscrow', address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' },
      identityRegistry: { contract: 'IdentityRegistry', address: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' },
    }
    const manifest = readManifest(JSON.stringify(deployed))

    expect(manifest.deployments).to.deep.eq([
      {
        chainId: 31337,
        deployBlock: 1,
        identityRegistry: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        escrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        token: { address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', decimals: 6 },
        originSigner: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      },
    ])
    expect(readManifest([deployed, MANIFEST]).deployments).to.have.length(2)
    expect(readManifest({ deployments: [MANIFEST] }).deployments).to.have.length(1)
    expect(registryDeployment(manifest, 31337, '0x9FE46736679D2D9A65F0992F2272DE9F3C7FA6E0'.toLowerCase())?.deployBlock).to.eq(1)
    expect(registryDeployment(manifest, 1, deployed.identityRegistry.address)).to.eq(null)

    for (const bad of ['{', [], { chainId: 0 }, { chainId: 31337, identityRegistry: { address: '0x12' } }, { chainId: 31337, deployBlock: -1 }]) {
      expect(() => readManifest(bad), JSON.stringify(bad)).to.throw(ManifestError)
    }
  })

  it('throws for a manifest it cannot read rather than reporting a result under it', async () => {
    let thrown: unknown = null

    try {
      await verifyPresentation(ANCHORED, { manifest: { chainId: 'one' } })
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(ManifestError)
  })
})

describe('jsonRpcTransport', () => {
  const URL = 'https://rpc.example.invalid/v1'

  function fetchAnswering(answer: { ok?: boolean; status?: number; body?: unknown; fail?: string }) {
    const calls: { url: string; init: Parameters<FetchLike>[1] }[] = []
    const fake: FetchLike = async (url, init) => {
      calls.push({ url, init })

      if (answer.fail) throw new Error(answer.fail)

      return {
        ok: answer.ok ?? true,
        status: answer.status ?? 200,
        json: async () => {
          if (answer.body === undefined) throw new Error('Unexpected token <')

          return answer.body
        },
      }
    }

    return { fake, calls }
  }

  it('posts JSON-RPC to the endpoint it was given, with no credentials and no redirects', async () => {
    const { fake, calls } = fetchAnswering({ body: { jsonrpc: '2.0', id: 1, result: '0x7a69' } })
    const rpc = jsonRpcTransport(URL, { fetch: fake })

    expect(await rpc('eth_chainId', [])).to.eq('0x7a69')
    expect(calls.map(({ url }) => url)).to.deep.eq([URL])
    expect(calls[0].init.method).to.eq('POST')
    expect(calls[0].init.credentials).to.eq('omit')
    expect(calls[0].init.redirect).to.eq('error')
    expect(JSON.parse(calls[0].init.body)).to.deep.eq({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
  })

  it('reports every failure as RpcUnavailableError, and tells a refusal from silence', async () => {
    const kinds: [string, string][] = []

    for (const [name, answer] of [
      ['connection refused', { fail: 'connect ECONNREFUSED' }],
      ['HTTP 502', { ok: false, status: 502 }],
      ['an HTML error page', {}],
      ['JSON that is not JSON-RPC', { body: { message: 'rate limited' } }],
      ['a JSON-RPC error', { body: { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'unknown block tag' } } }],
    ] as [string, Parameters<typeof fetchAnswering>[0]][]) {
      try {
        await jsonRpcTransport(URL, { fetch: fetchAnswering(answer).fake })('eth_chainId', [])
        kinds.push([name, 'answered'])
      } catch (error) {
        expect(error, name).to.be.instanceOf(RpcUnavailableError)
        kinds.push([name, (error as RpcUnavailableError).kind])
      }
    }

    expect(kinds).to.deep.eq([
      ['connection refused', 'unreachable'],
      ['HTTP 502', 'unreachable'],
      ['an HTML error page', 'unreachable'],
      ['JSON that is not JSON-RPC', 'unreachable'],
      ['a JSON-RPC error', 'refused'],
    ])
  })

  it('an endpoint that dies while asked for its finalized block is RpcUnavailable, not NotFinal', async () => {
    const { rpc } = scriptedRpc({})
    const dying = jsonRpcTransport(URL, {
      fetch: async (_url, init) => {
        const { id, method, params } = JSON.parse(init.body) as { id: number; method: string; params: unknown[] }

        if (method === 'eth_getBlockByNumber' && params[0] === 'finalized') throw new Error('socket hang up')

        return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id, result: await rpc(method, params) }) }
      },
    })

    expect((await verifyPresentation(ANCHORED, { manifest: MANIFEST, rpc: dying })).result).to.eq('RpcUnavailable')
  })
})
