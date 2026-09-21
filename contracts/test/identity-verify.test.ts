import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers'
import { execFile } from 'node:child_process'
import dns from 'node:dns'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildProfileTree,
  createAnchoredPresentation,
  createSelfSignedPresentation,
  evmSubject,
  isWithdrawn,
  jsonRpcTransport,
  selfSignedMessageFor,
  serializeDocument,
  verifyPresentation,
} from '../packages/identity/src'

import { inProcessRpc, startRpcBridge } from './helpers/rpc-bridge'

import type { ProfilePresentation, ProfileTree, VerificationResult } from '../packages/identity/src'

/**
 * ID-08, SC-A04 and SC-A05: the independent verifier against a deployed
 * IdentityRegistry, with nothing to go on but a presentation, a deployment
 * manifest and an RPC endpoint. No Work Address API exists in this suite, so
 * nothing here could be asking one; the first test also proves it, by
 * refusing every request that is not the JSON-RPC POST to the endpoint.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const FIELDS = { name: 'Margaret Hamilton', title: 'Director of software engineering', skills: ['Flight software'] }
const VERIFY = path.join(__dirname, '../packages/identity/bin/verify')

async function deploy() {
  const [holder, other, stranger] = await ethers.getSigners()
  const registry: Any = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  const copy: Any = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const registryAddress: string = await registry.getAddress()
  const manifest = {
    network: 'hardhat',
    chainId,
    deployBlock: 0,
    identityRegistry: { contract: 'IdentityRegistry', address: registryAddress },
  }

  return { holder, other, stranger, registry, copy, chainId, registryAddress, manifest }
}

function treeOf(address: string, chainId: number, fields: Record<string, unknown> = FIELDS): ProfileTree {
  return buildProfileTree({ subject: evmSubject(address, chainId), fields })
}

function present(tree: ProfileTree, registry: string, chainId: number, version = 1): ProfilePresentation {
  return createAnchoredPresentation(tree, { disclose: ['name', 'skills'], anchor: { chainId, registry, version } })
}

/** Publishes the tree as the holder's next version and answers the presentation of it. */
async function publish(registry: Any, holder: Any, tree: ProfileTree, chainId: number): Promise<ProfilePresentation> {
  const version = Number(await registry.versionCount(holder.address)) + 1
  const presentation = present(tree, await registry.getAddress(), chainId, version)

  await registry.connect(holder).publish(presentation.commitment, 1, version - 1)

  return presentation
}

function runCli(args: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [VERIFY, ...args], (error, stdout, stderr) => {
      resolve({ status: error ? Number(error.code) : 0, stdout, stderr })
    })
  })
}

describe('independent verifier on IdentityRegistry', function () {
  this.timeout(120_000)

  const rpc = inProcessRpc(hre.network.provider)

  it('SC-A04: verifies with every other host unreachable, and one changed character is InvalidProof', async () => {
    const { holder, registry, chainId, manifest } = await loadFixture(deploy)
    const presentation = await publish(registry, holder, treeOf(holder.address, chainId), chainId)
    const bridge = await startRpcBridge(hre.network.provider)
    const requested: string[] = []
    const lookups: string[] = []
    const realFetch = globalThis.fetch
    const realLookup = dns.lookup

    // The endpoint is an IP literal, so a DNS lookup of anything is a request to somewhere else.
    ;(dns as Any).lookup = (hostname: string, ...rest: unknown[]) => {
      lookups.push(hostname)

      return (realLookup as Any)(hostname, ...rest)
    }
    globalThis.fetch = ((input: Any, init?: Any) => {
      requested.push(`${init?.method ?? 'GET'} ${String(input)}`)

      if (String(input) !== bridge.url) throw new Error(`unreachable: ${String(input)}`)

      return realFetch(input, init)
    }) as typeof fetch

    try {
      const report = await verifyPresentation(serializeDocument(presentation), { manifest, rpc: jsonRpcTransport(bridge.url) })

      expect(report.result).to.eq('Current')
      expect(report.accepted).to.eq(true)
      expect(report.finalized).to.eq(true)
      expect(report.checkedAtBlock).to.eq(await ethers.provider.getBlockNumber())
      expect(report.disclosed.map((field) => [field.key, field.value])).to.deep.eq([
        ['name', 'Margaret Hamilton'],
        ['skills', ['Flight software']],
      ])

      expect(requested.length).to.be.greaterThan(0)
      expect([...new Set(requested)]).to.deep.eq([`POST ${bridge.url}`])
      expect(lookups, 'DNS lookups').to.deep.eq([])
      expect([...new Set(bridge.methods)].sort()).to.deep.eq(['eth_call', 'eth_chainId', 'eth_getBlockByNumber'])

      const before = requested.length
      const tampered = JSON.parse(serializeDocument(presentation)) as ProfilePresentation

      tampered.disclosures[0].value = 'Margaret Hamiltom'

      const refused = await verifyPresentation(tampered, { manifest, rpc: jsonRpcTransport(bridge.url) })

      expect(refused.result).to.eq('InvalidProof')
      expect(refused.accepted).to.eq(false)
      expect(refused.disclosed).to.deep.eq([])
      expect(refused.checkedAtBlock).to.eq(null)
      expect(requested.length, 'a failed proof never reaches the chain').to.eq(before)
    } finally {
      globalThis.fetch = realFetch
      ;(dns as Any).lookup = realLookup
      await bridge.close()
    }
  })

  it('SC-A05: answers each chain result as the registry gives it', async () => {
    const { holder, other, stranger, registry, chainId, registryAddress, manifest } = await loadFixture(deploy)
    const resultOf = async (document: ProfilePresentation) => (await verifyPresentation(document, { manifest, rpc })).result

    const never = present(treeOf(stranger.address, chainId), registryAddress, chainId)

    expect(await resultOf(never)).to.eq('Unpublished')

    const first = await publish(registry, holder, treeOf(holder.address, chainId), chainId)

    expect(await resultOf(first)).to.eq('Current')
    expect(await resultOf(present(treeOf(holder.address, chainId), registryAddress, chainId, 5))).to.eq('VersionUnknown')
    // Fresh salts give the same fields another root: a commitment the registry never saw as version 1.
    expect(await resultOf(present(treeOf(holder.address, chainId), registryAddress, chainId))).to.eq('CommitmentMismatch')

    const second = await publish(registry, holder, treeOf(holder.address, chainId, { ...FIELDS, title: 'Founder' }), chainId)

    expect(await resultOf(first)).to.eq('Superseded')
    expect(await resultOf(second)).to.eq('Current')

    // The same commitment published under schema 2: the chain disagrees with the document about the schema.
    const underAnotherSchema = present(treeOf(other.address, chainId), registryAddress, chainId)

    await registry.connect(other).publish(underAnotherSchema.commitment, 2, 0)
    expect(await resultOf(underAnotherSchema)).to.eq('SchemaMismatch')

    await registry.connect(holder).deactivate(2)

    const withdrawn = await verifyPresentation(second, { manifest, rpc })

    expect(withdrawn.result).to.eq('Deactivated')
    expect(withdrawn.accepted).to.eq(false)
    expect(isWithdrawn(withdrawn)).to.eq(true)
  })

  it('reports an old version of a withdrawn profile as Superseded and withdrawn', async () => {
    const { holder, registry, chainId, manifest } = await loadFixture(deploy)
    const first = await publish(registry, holder, treeOf(holder.address, chainId), chainId)

    await publish(registry, holder, treeOf(holder.address, chainId), chainId)

    const superseded = await verifyPresentation(first, { manifest, rpc })

    expect([superseded.result, superseded.subjectDeactivated, isWithdrawn(superseded)]).to.deep.eq(['Superseded', false, false])

    await registry.connect(holder).deactivate(2)

    const after = await verifyPresentation(first, { manifest, rpc })

    expect([after.result, after.subjectDeactivated, isWithdrawn(after)]).to.deep.eq(['Superseded', true, true])
  })

  it('refuses a second registry deployment with the identical scheme as RegistryNotInManifest', async () => {
    const { holder, copy, chainId, manifest } = await loadFixture(deploy)
    const onCopy = await publish(copy, holder, treeOf(holder.address, chainId), chainId)
    const asked: string[] = []
    const counting = (method: string, params: unknown[]) => {
      asked.push(method)

      return rpc(method, params)
    }

    // The copy itself calls it Current: only the manifest tells the two apart.
    const [result] = await copy.checkPresentation(holder.address, 1, onCopy.commitment, 1)

    expect(Number(result)).to.eq(6)

    const report = await verifyPresentation(onCopy, { manifest, rpc: counting })

    expect(report.result).to.eq('RegistryNotInManifest')
    expect(report.accepted).to.eq(false)
    expect(asked, 'an unlisted registry is never asked').to.deep.eq([])

    const listed = { ...manifest, identityRegistry: { contract: 'IdentityRegistry', address: await copy.getAddress() } }

    expect((await verifyPresentation(onCopy, { manifest: [manifest, listed], rpc })).result).to.eq('Current')
  })

  it('keeps RpcUnavailable apart from InvalidProof, and NotFinal apart from Current', async () => {
    const { holder, registry, chainId, manifest } = await loadFixture(deploy)
    const beforePublish = await ethers.provider.getBlock('latest')
    const presentation = await publish(registry, holder, treeOf(holder.address, chainId), chainId)

    const bridge = await startRpcBridge(hre.network.provider)
    const deadUrl = bridge.url

    await bridge.close()

    const down = await verifyPresentation(presentation, { manifest, rpc: jsonRpcTransport(deadUrl) })

    expect(down.result).to.eq('RpcUnavailable')
    expect(down.accepted).to.eq(false)
    expect(down.checkedAtBlock).to.eq(null)
    expect(down.detail).to.contain('says nothing about the document')
    // The proofs held: the fields are still the document's, only the chain's answer is missing.
    expect(down.disclosed).to.have.length(2)

    // A node whose finalized block is still the one before the publication.
    const lagging = await startRpcBridge(hre.network.provider, (method, params) =>
      method === 'eth_getBlockByNumber' && params[0] === 'finalized'
        ? hre.network.provider.request({ method, params: [`0x${beforePublish!.number.toString(16)}`, false] })
        : undefined,
    )

    try {
      const pending = await verifyPresentation(presentation, { manifest, rpc: jsonRpcTransport(lagging.url) })

      expect(pending.result).to.eq('NotFinal')
      expect(pending.accepted).to.eq(false)
      expect(pending.atFinalized?.result).to.eq('Unpublished')
      expect(pending.atLatest?.result).to.eq('Current')
      expect(pending.checkedAtBlock).to.eq(beforePublish!.number)

      // Asked for the head alone, the same node says Current, and says it is not final.
      const head = await verifyPresentation(presentation, { manifest, rpc: jsonRpcTransport(lagging.url), finality: 'latest' })

      expect([head.result, head.finalized]).to.deep.eq(['Current', false])
    } finally {
      await lagging.close()
    }

    // An endpoint for another chain cannot answer for this one.
    const elsewhere = await verifyPresentation(presentation, {
      manifest,
      rpc: (method, params) => (method === 'eth_chainId' ? Promise.resolve('0x1') : rpc(method, params)),
    })

    expect(elsewhere.result).to.eq('RpcUnavailable')
  })

  it('answers the off-chain results without a chain', async () => {
    const { holder, other, chainId, registryAddress, manifest } = await loadFixture(deploy)
    const tree = treeOf(holder.address, chainId)
    const anchored = present(tree, registryAddress, chainId)
    const refuse = () => Promise.reject(new Error('the chain must not be asked'))
    const resultOf = async (document: unknown, options = {}) =>
      (await verifyPresentation(document, { manifest, rpc: refuse, ...options })).result

    const selfSigned = createSelfSignedPresentation(tree, {
      disclose: ['name'],
      signature: await holder.signMessage(selfSignedMessageFor(tree)),
    })
    const forged = { ...selfSigned, signature: { scheme: 'eip191', value: await other.signMessage(selfSignedMessageFor(tree)) } }
    const accepted = await verifyPresentation(selfSigned, { manifest, rpc: refuse })

    expect([accepted.result, accepted.accepted, accepted.checkedAtBlock]).to.deep.eq(['SelfSignedOnly', true, null])

    const results: [string, VerificationResult][] = [
      ['forged signature', await resultOf(forged)],
      ['another schema', await resultOf({ ...anchored, schemaId: 2 })],
      ['a DID method nobody here reads', await resultOf({ ...anchored, subject: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK' })],
      ['not JSON', await resultOf('{"format":')],
      ['another format', await resultOf({ ...anchored, format: 'someone-else/profile' })],
      ['another account expected', await resultOf(anchored, { expectedSubject: other.address })],
      ['the expected account', await resultOf(selfSigned, { expectedSubject: holder.address.toLowerCase() })],
    ]

    expect(results).to.deep.eq([
      ['forged signature', 'SignatureInvalid'],
      ['another schema', 'UnsupportedSchema'],
      ['a DID method nobody here reads', 'UnsupportedSubjectScheme'],
      ['not JSON', 'MalformedExport'],
      ['another format', 'MalformedExport'],
      ['another account expected', 'SubjectMismatch'],
      ['the expected account', 'SelfSignedOnly'],
    ])
  })

  it('the command exits 0 only for Current and SelfSignedOnly, and always prints the block it checked', async () => {
    const { holder, registry, chainId, manifest } = await loadFixture(deploy)
    const tree = treeOf(holder.address, chainId)
    const first = await publish(registry, holder, tree, chainId)
    const selfSigned = createSelfSignedPresentation(tree, {
      disclose: ['name'],
      signature: await holder.signMessage(selfSignedMessageFor(tree)),
    })
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-verify-'))
    const write = (name: string, value: unknown) => {
      const file = path.join(directory, name)

      fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))

      return file
    }
    const manifestFile = write('manifest.json', manifest)
    const firstFile = write('first.json', serializeDocument(first))
    const bridge = await startRpcBridge(hre.network.provider)
    const identity = (file: string, ...rest: string[]) => runCli(['identity', file, '--manifest', manifestFile, '--rpc', bridge.url, ...rest])

    try {
      await mine(3)

      const head = await ethers.provider.getBlockNumber()
      const current = await identity(firstFile)

      expect(current.status, current.stderr).to.eq(0)
      expect(current.stdout).to.contain('Result: Current')
      expect(current.stdout).to.contain(`Block checked: ${head} (finalized)`)

      const selfSignedRun = await identity(write('self.json', serializeDocument(selfSigned)))

      expect(selfSignedRun.status).to.eq(0)
      expect(selfSignedRun.stdout).to.contain('Result: SelfSignedOnly')
      expect(selfSignedRun.stdout).to.contain('Block checked: none')

      await publish(registry, holder, treeOf(holder.address, chainId), chainId)
      await registry.connect(holder).deactivate(2)

      const superseded = await identity(firstFile, '--json')
      const report = JSON.parse(superseded.stdout.slice(0, superseded.stdout.lastIndexOf('Block checked')))

      expect(superseded.status).to.eq(1)
      expect([report.result, report.subjectDeactivated]).to.deep.eq(['Superseded', true])
      expect(superseded.stdout).to.contain(`Block checked: ${await ethers.provider.getBlockNumber()} (finalized)`)

      const tampered = JSON.parse(serializeDocument(first))

      tampered.disclosures[0].salt = `0x${'11'.repeat(32)}`

      const invalid = await identity(write('tampered.json', tampered))

      expect(invalid.status).to.eq(1)
      expect(invalid.stdout).to.contain('Result: InvalidProof')

      const unlisted = await runCli(['identity', firstFile, '--rpc', bridge.url])

      expect(unlisted.status).to.eq(1)
      expect(unlisted.stdout).to.contain('Result: RegistryNotInManifest')

      await bridge.close()

      const down = await identity(firstFile)

      expect(down.status).to.eq(3)
      expect(down.stdout).to.contain('Result: RpcUnavailable')
      expect(down.stdout).to.contain('Block checked: none')

      expect((await runCli(['identity'])).status).to.eq(2)
      expect((await runCli(['identity', firstFile, '--manifest', path.join(directory, 'missing.json')])).status).to.eq(2)
    } finally {
      await bridge.close().catch(() => undefined)
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
