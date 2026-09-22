import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Ajv from 'ajv'
import { expect } from 'chai'
import hre, { ethers } from 'hardhat'

import {
  buildProfileTree,
  createAnchoredPresentation,
  evmSubject,
  serializeDocument,
  verifyOfficialManifest,
} from '../packages/identity/src'

import type { OfficialManifest } from '../packages/identity/src'

import { DEPLOYMENTS_DIR, deployLocal, writeManifest } from '../scripts/local-chain'
import {
  assembleOfficialManifest,
  officialBody,
  officialDeploymentFrom,
  runOfficialManifest,
  signLocally,
  signingRequest,
} from '../scripts/official-manifest'

import type { DeploymentManifest } from '../scripts/deployment'

import { startRpcBridge } from './helpers/rpc-bridge'

/**
 * The publisher's side of the official allowlist, against the local node:
 * the request the tooling prints is what a wallet's eth_signTypedData_v4
 * signs, nothing is written without a signature that recovers the
 * publisher, and the command-line verifier uses a signed list only once its
 * signature holds. Hardhat's account #9 plays the publisher: its key is
 * public, which is exactly why it can only ever sign a development list.
 */

const FIXTURE = path.join(__dirname, 'fixtures/official-deployments.contract.json')
const SIGNED = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as OfficialManifest
const VERIFY = path.join(__dirname, '../packages/identity/bin/verify')

function runCli(args: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [VERIFY, ...args], (error, stdout, stderr) => {
      resolve({ status: error ? Number(error.code) : 0, stdout, stderr })
    })
  })
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }

  throw new Error('Expected a rejection')
}

describe('official deployment allowlist: the publisher side', function () {
  this.timeout(120_000)

  let directory: string
  let publisher: string
  let deployment: DeploymentManifest
  let deploymentFile: string

  const write = (name: string, value: unknown): string => {
    const file = path.join(directory, name)

    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2))

    return file
  }

  before(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-official-'))
    publisher = (await ethers.getSigners())[9].address
    deployment = await deployLocal(hre)
    deploymentFile = path.join(directory, 'localhost.json')
    writeManifest(deploymentFile, deployment)
  })

  after(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it("prints the request a wallet's eth_signTypedData_v4 signs, byte for byte the shared fixture's signature", async () => {
    const body = { issuedAt: SIGNED.issuedAt, deployments: SIGNED.deployments }
    const signature = await hre.network.provider.request({
      method: 'eth_signTypedData_v4',
      params: [SIGNED.publisher, signingRequest(body)],
    })

    expect(publisher).to.eq(SIGNED.publisher)
    expect(signature).to.eq(SIGNED.signature)
    expect(verifyOfficialManifest(SIGNED, publisher).deployments).to.deep.eq(SIGNED.deployments)
  })

  it('writes documents deployments/official.schema.json accepts, and nothing it refuses', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, 'official.schema.json'), 'utf8'))
    const validate = new Ajv({ allErrors: true, strict: true }).compile(schema)
    const [entry] = SIGNED.deployments

    expect(validate(SIGNED), JSON.stringify(validate.errors)).to.eq(true)
    expect(validate({ ...SIGNED, $schema: './official.schema.json' })).to.eq(true)
    expect(validate({ ...SIGNED, revoked: [] })).to.eq(false)
    expect(validate({ ...SIGNED, deployments: [{ ...entry, revoked: true }] })).to.eq(false)
    expect(validate({ ...SIGNED, deployments: [{ ...entry, escrow: `0x${'0'.repeat(40)}` }] })).to.eq(false)
    expect(validate({ ...SIGNED, deployments: [] })).to.eq(false)
    expect(validate({ ...SIGNED, signature: '0x1234' })).to.eq(false)
    expect(validate({ ...SIGNED, version: 2 })).to.eq(false)
  })

  it('vouches for a deployment as its deploy recorded it, and never for a dry run', () => {
    const entry = officialDeploymentFrom(deployment, 'contracts-0.1.0')

    expect(entry).to.deep.eq({
      chainId: 31337,
      release: 'contracts-0.1.0',
      escrow: deployment.escrow.address,
      token: deployment.token.address,
      tokenDecimals: 6,
      identityRegistry: deployment.identityRegistry.address,
      originSigner: deployment.originSigner,
      feeRecipient: deployment.feeRecipient,
      deployBlock: deployment.deployBlock,
      escrowCodeHash: deployment.escrow.runtimeCodeHash,
      registryCodeHash: deployment.identityRegistry.runtimeCodeHash,
    })
    expect(() =>
      officialDeploymentFrom({ ...deployment, dryRun: { forkBlock: 1, simulatedChainId: 31337, gasSimulated: false } }, 'x'),
    ).to.throw(/dry run: its addresses exist nowhere/)
  })

  it('without a signature prints the request and writes nothing', async () => {
    const out = path.join(directory, 'unsigned.json')
    const lines: string[] = []
    const result = await runOfficialManifest(hre, {
      deployments: [deploymentFile],
      publisher,
      issuedAt: '1790000000',
      out,
      log: (line) => lines.push(line),
    })

    expect(result).to.eq(null)
    expect(fs.existsSync(out)).to.eq(false)
    expect(lines.join('\n')).to.contain(`--issued-at 1790000000 --signature`)
    expect(JSON.parse(lines[lines.length - 1]).primaryType).to.eq('OfficialDeployments')
  })

  it('writes nothing for a signature that is not the publisher’s over exactly this list', async () => {
    const body = officialBody([deploymentFile], { release: 'contracts-0.1.0', issuedAt: 1_790_000_000 })
    const signature = await signLocally(hre, body, publisher)
    const out = path.join(directory, 'wrong.json')
    const run = (options: { signature: string; issuedAt: string; publisher?: string }) =>
      rejection(
        runOfficialManifest(hre, {
          deployments: [deploymentFile],
          release: 'contracts-0.1.0',
          out,
          log: () => undefined,
          publisher: options.publisher ?? publisher,
          ...options,
        }),
      )

    expect((await run({ signature, issuedAt: '1790000001' })).message).to.match(/changed after signing/)
    expect((await run({ signature, issuedAt: '1790000000', publisher: (await ethers.getSigners())[8].address })).message).to.match(
      new RegExp(`signed by someone else \\(${publisher}\\)`),
    )
    expect(fs.existsSync(out)).to.eq(false)
    expect(assembleOfficialManifest(body, publisher, signature).signature).to.eq(signature)
  })

  it('lets the node sign a list of local deployments only', async () => {
    const sepolia = { ...deployment, network: 'sepolia', chainId: 11155111 }
    const sepoliaFile = write('sepolia.json', sepolia)
    const body = officialBody([deploymentFile, sepoliaFile], { release: 'contracts-0.1.0', issuedAt: 1 })

    expect((await rejection(signLocally(hre, body, publisher))).message).to.match(
      /Only a list of local \(31337\) deployments is signed by the node; chain 11155111/,
    )
  })

  describe('the command-line verifier', () => {
    let official: string
    let tampered: string
    let plain: string

    before(async () => {
      official = path.join(directory, 'official.json')
      await runOfficialManifest(hre, {
        deployments: [deploymentFile],
        publisher,
        signLocally: true,
        out: official,
        log: () => undefined,
      })

      const changed = JSON.parse(fs.readFileSync(official, 'utf8')) as OfficialManifest

      changed.deployments[0].identityRegistry = ethers.Wallet.createRandom().address
      tampered = write('tampered.json', changed)
      plain = deploymentFile
    })

    it('verify manifest: 0 when the publisher signed it, 1 when it was changed or signed by another, 2 without --publisher', async () => {
      const verified = await runCli(['manifest', official, '--publisher', publisher])
      const changed = await runCli(['manifest', tampered, '--publisher', publisher])
      const another = await runCli(['manifest', official, '--publisher', (await ethers.getSigners())[8].address])
      const unnamed = await runCli(['manifest', official])

      expect(verified.status, verified.stderr).to.eq(0)
      expect(verified.stdout).to.contain(`Signed by ${publisher}`)
      expect(verified.stdout).to.contain(`escrow ${deployment.escrow.address}`)
      expect([changed.status, changed.stderr]).to.satisfy(([status, stderr]: [number, string]) =>
        status === 1 && /Refuted: .*changed after signing/.test(stderr),
      )
      expect(another.status).to.eq(1)
      expect(unnamed.status).to.eq(2)
      expect(unnamed.stderr).to.contain('--publisher is required')
    })

    it('reads a profile against the registry a signed list names, and asks no chain when the list was changed', async () => {
      const [holder] = await ethers.getSigners()
      const registry = (await ethers.getContractAt('IdentityRegistry', deployment.identityRegistry.address)) as unknown as {
        versionCount(subject: string): Promise<bigint>
        connect(signer: unknown): { publish(commitment: string, schemaId: number, expected: number): Promise<unknown> }
      }
      const tree = buildProfileTree({ subject: evmSubject(holder.address, 31337), fields: { name: 'Grace Hopper' } })
      const version = Number(await registry.versionCount(holder.address)) + 1
      const presentation = createAnchoredPresentation(tree, {
        disclose: ['name'],
        anchor: { chainId: 31337, registry: deployment.identityRegistry.address, version },
      })

      await registry.connect(holder).publish(presentation.commitment!, 1, version - 1)

      const document = write('presentation.json', serializeDocument(presentation))
      const bridge = await startRpcBridge(hre.network.provider)
      const identity = (...rest: string[]) => runCli(['identity', document, '--rpc', bridge.url, ...rest])

      try {
        const current = await identity('--manifest', official, '--publisher', publisher)

        expect(current.status, current.stderr).to.eq(0)
        expect(current.stdout).to.contain('Result: Current')

        const asked = bridge.methods.length
        const changed = await identity('--manifest', tampered, '--publisher', publisher)
        const unnamed = await identity('--manifest', official)
        const unsigned = await identity('--manifest', plain, '--publisher', publisher)

        expect(changed.status).to.eq(2)
        expect(changed.stderr).to.match(/not signed by .*changed after signing/)
        expect(unnamed.status).to.eq(2)
        expect(unnamed.stderr).to.contain('name the publisher you trust with --publisher')
        expect(unsigned.status).to.eq(2)
        expect(unsigned.stderr).to.contain('this manifest is not signed')
        expect(bridge.methods.length, 'no chain is asked under a list that does not hold').to.eq(asked)
      } finally {
        await bridge.close()
      }
    })
  })
})
