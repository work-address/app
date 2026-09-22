import { expect } from 'chai'
import fs from 'node:fs'
import path from 'node:path'

import { Wallet, getAddress, hexlify, randomBytes } from 'ethers'

import type { HDNodeWallet } from 'ethers'

import {
  ManifestError,
  OFFICIAL_DOMAIN,
  OFFICIAL_TYPES,
  escrowDeployment,
  isOfficialManifest,
  officialDigest,
  officialEscrow,
  officialTypedData,
  readManifest,
  readOfficialManifest,
  registryDeployment,
  verifyOfficialManifest,
} from '../src'

import type { OfficialDeployment, OfficialDeploymentsBody, OfficialManifest } from '../src'

/**
 * The signed allowlist of official deployments, checked with nothing but the
 * publisher's address. The fixture is shared with the marketplace API
 * (`api/src/test/fixture` in the web repository), which must accept exactly
 * what this accepts; it was signed by Hardhat's public account #9 through
 * the node's own eth_signTypedData_v4, so it is what a wallet produces.
 */
const FIXTURE = path.join(__dirname, '../../../test/fixtures/official-deployments.contract.json')
const SIGNED = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as OfficialManifest
const PUBLISHER = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'

function copy(): OfficialManifest {
  return JSON.parse(JSON.stringify(SIGNED)) as OfficialManifest
}

function someAddress(): string {
  return getAddress(hexlify(randomBytes(20)))
}

function refusal(input: unknown, publisher = PUBLISHER): string {
  try {
    verifyOfficialManifest(input, publisher)
  } catch (error) {
    expect(error).to.be.instanceOf(ManifestError)

    return (error as Error).message
  }

  throw new Error('Expected the manifest to be refused')
}

/** A document `wallet` signs over `body`, as the publisher's tooling assembles it. */
async function signedBy(wallet: Wallet | HDNodeWallet, body: OfficialDeploymentsBody): Promise<OfficialManifest> {
  const { message } = officialTypedData(body)
  const types = JSON.parse(JSON.stringify(OFFICIAL_TYPES)) as Record<string, { name: string; type: string }[]>

  return {
    format: 'work-address/official-deployments',
    version: 1,
    publisher: wallet.address,
    issuedAt: body.issuedAt,
    deployments: message.deployments,
    signature: await wallet.signTypedData(OFFICIAL_DOMAIN, types, message),
  }
}

function sepoliaEntry(): OfficialDeployment {
  return {
    chainId: 11155111,
    release: 'contracts-0.1.0',
    escrow: someAddress(),
    token: someAddress(),
    tokenDecimals: 6,
    identityRegistry: someAddress(),
    originSigner: someAddress(),
    feeRecipient: someAddress(),
    deployBlock: 7_000_000,
    escrowCodeHash: hexlify(randomBytes(32)),
    registryCodeHash: hexlify(randomBytes(32)),
  }
}

describe('official deployment allowlist', () => {
  it('accepts the shared fixture under its publisher, and returns what it vouches for', () => {
    const verified = verifyOfficialManifest(SIGNED, PUBLISHER)
    const [local] = SIGNED.deployments

    expect(verified.publisher).to.eq(PUBLISHER)
    expect(verified.issuedAt).to.eq(1_790_000_000)
    expect(verified.deployments).to.deep.eq(SIGNED.deployments)
    expect(officialEscrow(verified, 31337, local.escrow.toLowerCase())).to.deep.eq(local)
    expect(officialEscrow(verified, 11155111, local.escrow)).to.eq(null)
    expect(officialEscrow(verified, 31337, someAddress())).to.eq(null)
    expect(officialEscrow(verified, 31337, 'not an address')).to.eq(null)
  })

  it('hands the verifier functions a manifest they read, and holds addresses to it', () => {
    const { manifest } = verifyOfficialManifest(JSON.stringify(SIGNED), PUBLISHER)
    const [local] = SIGNED.deployments
    const read = readManifest(manifest)

    expect(escrowDeployment(read, 31337, local.escrow)?.token).to.deep.eq({ address: local.token, decimals: 6 })
    expect(registryDeployment(read, 31337, local.identityRegistry)?.originSigner).to.eq(local.originSigner)
    expect(escrowDeployment(read, 31337, someAddress())).to.eq(null)
  })

  it('is refused unread where a plain deployment manifest is expected', () => {
    expect(isOfficialManifest(SIGNED)).to.eq(true)
    expect(isOfficialManifest(JSON.stringify(SIGNED))).to.eq(true)
    expect(isOfficialManifest({ chainId: 31337 })).to.eq(false)
    expect(isOfficialManifest('not json')).to.eq(false)
    expect(() => readManifest(SIGNED)).to.throw(ManifestError, /signed official manifest.*verifyOfficialManifest/)
    expect(() => readManifest(JSON.stringify(SIGNED))).to.throw(ManifestError, /signed official manifest/)
  })

  it('refuses every signed field changed after signing', () => {
    const changes: [string, (entry: Record<string, unknown>) => void][] = [
      ['chainId', (entry) => (entry.chainId = 11155111)],
      ['release', (entry) => (entry.release = 'contracts-0.2.0')],
      ['escrow', (entry) => (entry.escrow = someAddress())],
      ['token', (entry) => (entry.token = someAddress())],
      ['tokenDecimals', (entry) => (entry.tokenDecimals = 18)],
      ['identityRegistry', (entry) => (entry.identityRegistry = someAddress())],
      ['originSigner', (entry) => (entry.originSigner = someAddress())],
      ['feeRecipient', (entry) => (entry.feeRecipient = someAddress())],
      ['deployBlock', (entry) => (entry.deployBlock = 2)],
      ['escrowCodeHash', (entry) => (entry.escrowCodeHash = hexlify(randomBytes(32)))],
      ['registryCodeHash', (entry) => (entry.registryCodeHash = hexlify(randomBytes(32)))],
    ]

    expect(changes.map(([field]) => field)).to.deep.eq(OFFICIAL_TYPES.OfficialDeployment.map((field) => field.name))

    for (const [field, change] of changes) {
      const tampered = copy()

      change(tampered.deployments[0] as unknown as Record<string, unknown>)
      expect(refusal(tampered), field).to.match(/is not signed by 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720: it was changed after signing/)
    }

    const later = copy()
    const added = copy()
    const doubled = copy()

    later.issuedAt += 1
    added.deployments.push(sepoliaEntry())
    doubled.deployments.push({ ...doubled.deployments[0], chainId: 11155111 })

    for (const [what, tampered] of [
      ['issuedAt', later],
      ['an added deployment', added],
      ['a deployment copied onto another chain', doubled],
    ] as const) {
      expect(refusal(tampered), what).to.match(/changed after signing/)
    }
  })

  it('reads a lower-case address as the same signed address', () => {
    const lower = copy()

    lower.deployments[0].escrow = lower.deployments[0].escrow.toLowerCase()
    expect(verifyOfficialManifest(lower, PUBLISHER).deployments[0].escrow).to.eq(SIGNED.deployments[0].escrow)
  })

  it('trusts the publisher the caller names, never the one the document names', async () => {
    const impostor = Wallet.createRandom()
    const forged = await signedBy(impostor, { issuedAt: SIGNED.issuedAt, deployments: SIGNED.deployments })

    // Self-consistent: it names its own signer, and that signer did sign it.
    expect(verifyOfficialManifest(forged, impostor.address).publisher).to.eq(impostor.address)
    expect(refusal(forged)).to.match(new RegExp(`names publisher ${impostor.address}, not the trusted ${PUBLISHER}`))

    // Claiming the trusted publisher does not make the signature theirs.
    expect(refusal({ ...forged, publisher: PUBLISHER })).to.match(new RegExp(`signed by someone else \\(${impostor.address}\\)`))
    expect(refusal(SIGNED, someAddress())).to.match(/not the trusted/)
    expect(refusal(SIGNED, 'nobody')).to.match(/trusted publisher is not an address/)
  })

  it('round-trips a list a publisher signs with an ordinary wallet', async () => {
    const publisher = Wallet.createRandom()
    const body = { issuedAt: 1_800_000_000, deployments: [SIGNED.deployments[0], sepoliaEntry()] }
    const document = await signedBy(publisher, body)
    const verified = verifyOfficialManifest(JSON.stringify(document), publisher.address)

    expect(verified.deployments).to.deep.eq(body.deployments)
    expect(officialEscrow(verified, 11155111, body.deployments[1].escrow)).to.deep.eq(body.deployments[1])
    expect(officialDigest(body)).to.match(/^0x[0-9a-f]{64}$/)
    expect(officialDigest({ ...body, issuedAt: body.issuedAt + 1 })).not.to.eq(officialDigest(body))
  })

  it('refuses a field it does not know rather than ignore it', () => {
    const extraTop = { ...copy(), revoked: [] }
    const extraEntry = copy()

    ;(extraEntry.deployments[0] as unknown as Record<string, unknown>).revoked = true

    expect(refusal(extraTop)).to.match(/does not know, and refuses to ignore: revoked/)
    expect(refusal(extraEntry)).to.match(/deployments\[0\] has fields this verifier does not know.*revoked/)
  })

  it('refuses a shape it cannot read', () => {
    const cases: [string, unknown, RegExp][] = [
      ['not JSON', '{', /not JSON/],
      ['another format', { ...copy(), format: 'work-address/profile-export' }, /Not an official deployment manifest/],
      ['another version', { ...copy(), version: 2 }, /version 2 is not one this verifier reads/],
      ['no deployments', { ...copy(), deployments: [] }, /lists no deployment/],
      ['no signature', { ...copy(), signature: '0x' }, /no 65-byte signature/],
      ['a zero escrow', { ...copy(), deployments: [{ ...SIGNED.deployments[0], escrow: `0x${'0'.repeat(40)}` }] }, /escrow is not a non-zero address/],
      ['a bad checksum', { ...copy(), deployments: [{ ...SIGNED.deployments[0], escrow: SIGNED.deployments[0].escrow.replace('e7f1', 'E7F1') }] }, /escrow is not a non-zero address/],
      ['a short hash', { ...copy(), deployments: [{ ...SIGNED.deployments[0], escrowCodeHash: '0x1234' }] }, /escrowCodeHash is a 32-byte hex string/],
      ['a fractional block', { ...copy(), deployments: [{ ...SIGNED.deployments[0], deployBlock: 1.5 }] }, /deployBlock is an integer/],
      ['chain 0', { ...copy(), deployments: [{ ...SIGNED.deployments[0], chainId: 0 }] }, /chainId is an integer from 1/],
      ['an escrow listed twice', { ...copy(), deployments: [SIGNED.deployments[0], SIGNED.deployments[0]] }, /lists escrow .* on chain 31337 twice/],
    ]

    for (const [what, input, message] of cases) {
      expect(() => readOfficialManifest(input), what).to.throw(ManifestError, message)
    }
  })
})
