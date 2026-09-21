import { expect } from 'chai'
import { ethers } from 'hardhat'
import fs from 'node:fs'
import path from 'node:path'

import {
  termsHashOf,
  verifyOrigin,
  type OriginCertificate,
} from '../scripts/verify-origin'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

/**
 * TSO-10, the third party's side of it. A settlement on chain carries an
 * opaque `termsHash`; the marketplace's origin certificate carries the bytes
 * behind it. This suite is the check anyone can run without the marketplace:
 * the disclosed bytes hash to what was signed, the signature recovers the
 * deployment's origin signer, the escrow contract agrees on the digest, and
 * the bytes name a specific posting and proposal, so the same proof cannot
 * be claimed for another engagement.
 *
 * `fixtures/terms-origin.contract.json` is byte-identical to
 * web/api/src/test/fixture/terms-origin.contract.json, where the marketplace's
 * own suite holds TermsHash.preimageV2 to these exact bytes.
 */
describe('origin certificate', () => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures/terms-origin.contract.json'),
      'utf8',
    ),
  )

  /** A deployment, and one allocation signed over the fixture's terms hash. */
  async function certificate(
    overrides: Partial<OriginCertificate> = {},
  ): Promise<{ signed: OriginCertificate; signer: string; escrow: Any }> {
    const [originSigner, feeRecipient, payer, payee] = await ethers.getSigners()
    const token = await (await ethers.getContractFactory('MockUSDT')).deploy()
    const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
    const escrow: Any = await Escrow.deploy(
      await token.getAddress(),
      feeRecipient.address,
      originSigner.address,
    )
    const chainId = Number((await ethers.provider.getNetwork()).chainId)
    const escrowAddress = await escrow.getAddress()
    const obligationId = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint64', 'uint64'],
      [
        'work-address:contract-period',
        fixture.preimage.contractId,
        1790000000,
        1790604800,
      ],
    )
    const domain = {
      name: 'WorkAddressMarketplaceEscrow',
      version: '1',
    }
    const types = {
      Terms: [
        { name: 'allocationId', type: 'bytes32' },
        { name: 'obligationId', type: 'bytes32' },
        { name: 'termsHash', type: 'bytes32' },
        { name: 'payer', type: 'address' },
        { name: 'payee', type: 'address' },
        { name: 'budget', type: 'uint256' },
        { name: 'workStart', type: 'uint64' },
        { name: 'workEnd', type: 'uint64' },
        { name: 'originExpiry', type: 'uint64' },
      ],
    }
    const terms = {
      allocationId: ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'bytes32'],
        [chainId, escrowAddress, obligationId],
      ),
      obligationId,
      termsHash: fixture.termsHash,
      payer: payer.address,
      payee: payee.address,
      budget: '100000000',
      workStart: 1790000000,
      workEnd: 1790604800,
      originExpiry: 1789990000,
    }
    const signature = await originSigner.signTypedData(
      { ...domain, chainId, verifyingContract: escrowAddress },
      types,
      terms,
    )

    return {
      signer: originSigner.address,
      escrow,
      signed: {
        contractId: fixture.preimage.contractId,
        version: 2,
        preimage: fixture.preimage,
        termsHash: fixture.termsHash,
        domain,
        types,
        allocations: [{ ...terms, chainId, escrowAddress, signature }],
        ...overrides,
      },
    }
  }

  it('recovers the origin signer offline and agrees with the escrow', async () => {
    const { signed, signer, escrow } = await certificate()
    const verdict = verifyOrigin(signed)
    const [allocation] = verdict.allocations

    expect(verdict.termsHash).to.eq(fixture.termsHash)
    expect(verdict.termsHashMatches).to.be.true
    expect(allocation.termsHashMatches).to.be.true
    expect(allocation.signer).to.eq(signer)
    // The digest the verifier computed is the one the contract computes.
    expect(await escrow.termsDigest(signed.allocations[0])).to.eq(
      allocation.digest,
    )
  })

  it('names the posting and the proposal the settlement belongs to', async () => {
    const { signed } = await certificate()
    const verdict = verifyOrigin(signed)

    expect(verdict.origin).to.deep.eq(fixture.preimage.origin)
    expect(verdict.origin?.jobId).to.be.a('string')
    expect(verdict.origin?.applicationId).to.be.a('string')
  })

  /**
   * The point of naming them: claiming the same signature for another
   * proposal changes the bytes, so the hash no longer opens what was signed.
   */
  it('refuses a preimage pointed at another proposal', async () => {
    const { signed } = await certificate()
    const moved = {
      ...signed,
      preimage: {
        ...signed.preimage,
        origin: {
          ...(signed.preimage.origin as Record<string, unknown>),
          applicationId: '00000000-0000-4000-8000-000000000000',
        },
      },
    }
    const verdict = verifyOrigin(moved)

    expect(termsHashOf(moved.preimage)).to.not.eq(fixture.termsHash)
    expect(verdict.termsHashMatches).to.be.false
    expect(verdict.allocations[0].termsHashMatches).to.be.false
  })

  /** A proof made for one escrow does not pass as one made for another. */
  it('refuses a signature moved to another deployment', async () => {
    const { signed } = await certificate()
    const elsewhere = {
      ...signed,
      allocations: [
        {
          ...signed.allocations[0],
          escrowAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        },
      ],
    }

    expect(verifyOrigin(elsewhere).allocations[0].signer).to.not.eq(
      verifyOrigin(signed).allocations[0].signer,
    )
  })
})
