import { expect } from 'chai'
import { ethers } from 'hardhat'
import fs from 'node:fs'
import path from 'node:path'

import {
  failuresOf,
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
 * own suite holds TermsHash.preimageV2 to these exact bytes - and, for its
 * `amended` case, holds the walk back through an accepted amendment to the
 * two preimages a certificate of an amended contract discloses.
 */
describe('origin certificate', () => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures/terms-origin.contract.json'),
      'utf8',
    ),
  )

  /**
   * A deployment, and one allocation signed over the fixture's terms hash.
   * With `amended`, the certificate of the same contract after the fixture's
   * amendment: both versions disclosed, the amended terms in force, and a
   * second allocation, for the week the amendment applies from, signed over
   * the amended hash. The first allocation still carries the original one.
   */
  async function certificate(
    overrides: Partial<OriginCertificate> = {},
    amended = false,
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
        { name: 'earlySubmission', type: 'bool' },
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
      // An hourly period: billed once it has ended.
      earlySubmission: false,
    }
    const sign = async (signedTerms: typeof terms) => ({
      ...signedTerms,
      chainId,
      escrowAddress,
      signature: await originSigner.signTypedData(
        { ...domain, chainId, verifyingContract: escrowAddress },
        types,
        signedTerms,
      ),
    })
    const allocations = [await sign(terms)]

    if (amended) {
      const workStart = Math.floor(
        Date.parse(fixture.amended.amendment.effectiveFrom) / 1000,
      )
      const laterObligationId = ethers.solidityPackedKeccak256(
        ['string', 'string', 'uint64', 'uint64'],
        [
          'work-address:contract-period',
          fixture.preimage.contractId,
          workStart,
          workStart + 604800,
        ],
      )

      allocations.push(
        await sign({
          ...terms,
          allocationId: ethers.solidityPackedKeccak256(
            ['uint256', 'address', 'bytes32'],
            [chainId, escrowAddress, laterObligationId],
          ),
          obligationId: laterObligationId,
          termsHash: fixture.amended.termsHash,
          workStart,
          workEnd: workStart + 604800,
          originExpiry: workStart - 3600,
        }),
      )
    }

    const inForce = amended ? fixture.amended : fixture

    return {
      signer: originSigner.address,
      escrow,
      signed: {
        contractId: fixture.preimage.contractId,
        version: 2,
        preimage: inForce.preimage,
        termsHash: inForce.termsHash,
        ...(amended
          ? {
              versions: [
                {
                  termsVersion: 1,
                  effectiveFrom: null,
                  version: 2,
                  preimage: fixture.preimage,
                  termsHash: fixture.termsHash,
                },
                {
                  termsVersion: fixture.amended.amendment.version,
                  effectiveFrom: fixture.amended.amendment.effectiveFrom,
                  version: 2,
                  preimage: fixture.amended.preimage,
                  termsHash: fixture.amended.termsHash,
                },
              ],
            }
          : {}),
        domain,
        types,
        allocations,
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

  it('opens a milestone, whose terms let the payee bill before the period ends', async () => {
    const [originSigner] = await ethers.getSigners()
    const { signed, signer, escrow } = await certificate()
    const hourly = signed.allocations[0]
    // The same period signed as a milestone: one flag apart, so the digest
    // must differ and the signature over the hourly terms must not open it.
    const { signature: _hourlySignature, chainId, escrowAddress, ...terms } =
      hourly
    const milestoneTerms = { ...terms, earlySubmission: true }
    const milestone = {
      ...milestoneTerms,
      chainId,
      escrowAddress,
      signature: await originSigner.signTypedData(
        { ...signed.domain, chainId, verifyingContract: escrowAddress },
        signed.types,
        milestoneTerms,
      ),
    }
    const verdict = verifyOrigin({ ...signed, allocations: [hourly, milestone] })

    expect(verdict.allocations[1].signer).to.eq(signer)
    expect(verdict.allocations[1].digest).to.not.eq(verdict.allocations[0].digest)
    expect(await escrow.termsDigest(milestone)).to.eq(
      verdict.allocations[1].digest,
    )
    // The hourly signature over the milestone's terms recovers someone else.
    const forged = verifyOrigin({
      ...signed,
      allocations: [{ ...milestone, signature: hourly.signature }],
    })

    expect(forged.allocations[0].signer).to.not.eq(signer)
  })

  it('opens a certificate issued before the terms carried earlySubmission', async () => {
    // What the API handed out until the escrow learned milestones: a Terms
    // type of nine fields and allocations without the tenth. The verifier
    // follows the type the certificate declares, so these still open.
    const [originSigner] = await ethers.getSigners()
    const { signed, signer } = await certificate()
    const legacyTypes = {
      Terms: signed.types.Terms.filter(
        ({ name }) => name !== 'earlySubmission',
      ),
    }
    const {
      signature: _signature,
      chainId,
      escrowAddress,
      earlySubmission: _earlySubmission,
      ...legacyTerms
    } = signed.allocations[0]
    const legacy = {
      ...legacyTerms,
      chainId,
      escrowAddress,
      signature: await originSigner.signTypedData(
        { ...signed.domain, chainId, verifyingContract: escrowAddress },
        legacyTypes,
        legacyTerms,
      ),
    }
    const verdict = verifyOrigin({
      ...signed,
      types: legacyTypes,
      allocations: [legacy],
    })

    expect(verdict.allocations[0].signer).to.eq(signer)
    expect(verdict.allocations[0].termsHashMatches).to.be.true
  })

  it('refuses an allocation that lacks a field its own certificate names', async () => {
    // The gap that made every certificate unverifiable: the type named
    // earlySubmission and the allocations did not carry it. Refused by name,
    // never hashed to something the signer did not sign.
    const { signed } = await certificate()
    const { earlySubmission: _earlySubmission, ...withoutTheFlag } =
      signed.allocations[0]

    expect(() =>
      verifyOrigin({ ...signed, allocations: [withoutTheFlag] }),
    ).to.throw(/names "earlySubmission"/)
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

  /**
   * An amended contract has two hashes on chain: the period funded before
   * the amendment keeps the one it was funded under. Both open - each to its
   * own version of the terms - both recover the origin signer, the escrow
   * agrees on both digests, and the run the CLI makes of it finds no fault.
   */
  it('opens a period funded before an amendment and one funded after it', async () => {
    const { signed, signer, escrow } = await certificate({}, true)
    const verdict = verifyOrigin(signed)
    const [before, after] = verdict.allocations

    expect(signed.allocations[0].termsHash).to.eq(fixture.termsHash)
    expect(signed.allocations[1].termsHash).to.eq(fixture.amended.termsHash)
    expect(fixture.amended.termsHash).to.not.eq(fixture.termsHash)

    expect(verdict.termsHash).to.eq(fixture.amended.termsHash)
    expect(verdict.termsHashMatches).to.be.true
    expect(
      verdict.versions.map((version) => [
        version.termsVersion,
        version.termsHash,
        version.termsHashMatches,
        version.sameEngagement,
      ]),
    ).to.deep.eq([
      [1, fixture.termsHash, true, true],
      [2, fixture.amended.termsHash, true, true],
    ])

    expect(before.termsHashMatches).to.be.true
    expect(before.termsVersion).to.eq(1)
    expect(before.signer).to.eq(signer)
    expect(after.termsHashMatches).to.be.true
    expect(after.termsVersion).to.eq(2)
    expect(after.signer).to.eq(signer)

    for (const [index, allocation] of verdict.allocations.entries()) {
      expect(await escrow.termsDigest(signed.allocations[index])).to.eq(
        allocation.digest,
      )
    }

    expect(failuresOf(signed, verdict, signer)).to.deep.eq([])
  })

  /**
   * Disclosing every version is what keeps the earlier period checkable:
   * with only the terms in force to go on, its hash opens to nothing and
   * the certificate is refused rather than passed on trust.
   */
  it('refuses an allocation none of the disclosed versions opens', async () => {
    const { signed } = await certificate({}, true)
    const withheld = { ...signed, versions: signed.versions?.slice(1) }
    const verdict = verifyOrigin(withheld)

    expect(verdict.allocations.map((a) => a.termsHashMatches)).to.deep.eq([
      false,
      true,
    ])
    expect(verdict.allocations[0].termsVersion).to.be.null
    expect(failuresOf(withheld, verdict)).to.deep.eq([
      `Allocation ${signed.allocations[0].allocationId} was signed over terms the certificate does not disclose`,
    ])
  })

  /**
   * A version is judged by its bytes, not by the hash written next to them,
   * and an amendment never changes who hired whom: earlier terms that claim
   * a hash they do not have, or name another proposal, fail the run.
   */
  it('refuses a version that lies about its hash or its engagement', async () => {
    const { signed } = await certificate({}, true)
    const [first, second] = signed.versions ?? []
    const relabelled = {
      ...signed,
      versions: [{ ...first, termsHash: fixture.amended.termsHash }, second],
    }
    const moved = {
      ...signed,
      versions: [
        {
          ...first,
          preimage: {
            ...first.preimage,
            origin: {
              ...(first.preimage.origin as Record<string, unknown>),
              applicationId: '00000000-0000-4000-8000-000000000000',
            },
          },
        },
        second,
      ],
    }

    expect(verifyOrigin(relabelled).versions[0].termsHashMatches).to.be.false
    // Matched on the bytes: the mislabelled version still opens its period.
    expect(verifyOrigin(relabelled).allocations[0].termsHashMatches).to.be.true
    expect(failuresOf(relabelled, verifyOrigin(relabelled))).to.have.length(1)

    expect(verifyOrigin(moved).versions[0].sameEngagement).to.be.false
    expect(verifyOrigin(moved).allocations[0].termsHashMatches).to.be.false
    expect(failuresOf(moved, verifyOrigin(moved))).to.have.length(3)
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
