import { TypedDataEncoder, keccak256, toUtf8Bytes, verifyTypedData } from 'ethers'

/**
 * Checks a Work Address origin certificate offline.
 *
 * The marketplace signs, for every escrow allocation, an EIP-712 `Terms`
 * struct whose `termsHash` is a commitment to the agreement behind it. On
 * chain that hash is opaque: it proves someone signed something. The
 * certificate — `GET /api/job-contract/{id}/origin`, handed out by either
 * participant — carries the exact bytes behind that hash, and those bytes
 * name the posting, the proposal and the two accounts the hire is between.
 *
 * So a third party can establish, with no access to the marketplace and no
 * trust in it, that:
 *
 *   1. keccak256(JSON.stringify(preimage)) is the `termsHash` in the signed
 *      struct — the disclosed terms are the terms that were signed;
 *   2. the signature recovers the origin signer the deployment publishes —
 *      the marketplace, and not someone replaying its format;
 *   3. the preimage's `origin` names a specific listing and application —
 *      so the same signature cannot be claimed for a different engagement.
 *
 * Nothing here touches a network. Run it against a saved certificate:
 *
 *   npx hardhat run scripts/verify-origin.ts --no-compile -- certificate.json
 *   ORIGIN_SIGNER=0x... npx ts-node scripts/verify-origin.ts certificate.json
 *
 * With ORIGIN_SIGNER set, a recovered address that is not it fails the run;
 * without it the recovered address is only reported.
 */

/** Where on the marketplace a hire came from, inside the hashed bytes. */
export type TermsOrigin = {
  jobId: string | null
  applicationId: string | null
  clientId: string | null
  freelancerId: string | null
  previousContractId: string | null
}

/** One allocation of a contract, with the origin proof over it. */
export type OriginAllocation = {
  allocationId: string
  obligationId: string
  chainId: number
  escrowAddress: string
  termsHash: string
  payer: string
  payee: string
  budget: string
  workStart: number
  workEnd: number
  originExpiry: number
  signature: string
}

export type OriginCertificate = {
  contractId: string
  /** 2 when `preimage` carries an `origin` block, 1 for a legacy contract. */
  version: number | null
  preimage: Record<string, unknown>
  termsHash: string
  domain: { name: string; version: string }
  types: Record<string, { name: string; type: string }[]>
  allocations: OriginAllocation[]
}

export type AllocationVerdict = {
  allocationId: string
  /** The EIP-712 digest the escrow contract computes for these terms. */
  digest: string
  /** Whoever signed it. Compare with the deployment's published signer. */
  signer: string
  /** The allocation's own hash is the one the preimage opens. */
  termsHashMatches: boolean
}

export type OriginVerdict = {
  contractId: string
  /** keccak256 of the certificate's preimage, re-serialised here. */
  termsHash: string
  /** That hash is the one the certificate claims was signed. */
  termsHashMatches: boolean
  /** Where the hire came from; null on a v1 certificate, which names none. */
  origin: TermsOrigin | null
  allocations: AllocationVerdict[]
}

/**
 * The hash the marketplace computed: keccak-256 over the UTF-8 of the
 * preimage's JSON, with no whitespace and in the key order it was given.
 * `JSON.stringify` preserves insertion order, and a parsed object keeps the
 * order of the document it came from, so a certificate read from disk
 * re-serialises to the bytes that were hashed.
 */
export function termsHashOf(preimage: unknown): string {
  return keccak256(toUtf8Bytes(JSON.stringify(preimage)))
}

/** The `origin` block of a v2 preimage; null when the preimage has none. */
export function originOf(preimage: Record<string, unknown>): TermsOrigin | null {
  const origin = preimage.origin

  return origin && typeof origin === 'object' && !Array.isArray(origin)
    ? (origin as TermsOrigin)
    : null
}

/**
 * The digest and the signer of one allocation. The domain is rebuilt from
 * the allocation's own chain and escrow, so a signature made for one
 * deployment cannot pass as one made for another.
 */
export function verifyAllocation(
  certificate: OriginCertificate,
  allocation: OriginAllocation,
  termsHash: string,
): AllocationVerdict {
  const domain = {
    ...certificate.domain,
    chainId: allocation.chainId,
    verifyingContract: allocation.escrowAddress,
  }
  const terms = {
    allocationId: allocation.allocationId,
    obligationId: allocation.obligationId,
    termsHash: allocation.termsHash,
    payer: allocation.payer,
    payee: allocation.payee,
    budget: allocation.budget,
    workStart: allocation.workStart,
    workEnd: allocation.workEnd,
    originExpiry: allocation.originExpiry,
  }

  return {
    allocationId: allocation.allocationId,
    digest: TypedDataEncoder.hash(domain, certificate.types, terms),
    signer: verifyTypedData(
      domain,
      certificate.types,
      terms,
      allocation.signature,
    ),
    termsHashMatches:
      allocation.termsHash.toLowerCase() === termsHash.toLowerCase(),
  }
}

/** Every check the certificate allows, with no network and no trust. */
export function verifyOrigin(certificate: OriginCertificate): OriginVerdict {
  const termsHash = termsHashOf(certificate.preimage)

  return {
    contractId: certificate.contractId,
    termsHash,
    termsHashMatches:
      termsHash.toLowerCase() === certificate.termsHash.toLowerCase(),
    origin: originOf(certificate.preimage),
    allocations: certificate.allocations.map((allocation) =>
      verifyAllocation(certificate, allocation, termsHash),
    ),
  }
}

/** The CLI: read a certificate, print the verdict, exit non-zero on a mismatch. */
async function main(): Promise<void> {
  const fs = await import('node:fs')
  const file = process.argv.slice(2).filter((argument) => argument !== '--')[0]

  if (!file) {
    throw new Error('Usage: verify-origin.ts <certificate.json>')
  }

  const certificate: OriginCertificate = JSON.parse(
    fs.readFileSync(file, 'utf8'),
  )
  const verdict = verifyOrigin(certificate)
  const expected = process.env.ORIGIN_SIGNER

  console.log(JSON.stringify(verdict, null, 2))

  if (!verdict.termsHashMatches) {
    throw new Error(
      `The disclosed terms hash to ${verdict.termsHash}, not to the ${certificate.termsHash} the certificate claims was signed`,
    )
  }

  for (const allocation of verdict.allocations) {
    if (!allocation.termsHashMatches) {
      throw new Error(
        `Allocation ${allocation.allocationId} was signed over other terms`,
      )
    }

    if (expected && allocation.signer.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(
        `Allocation ${allocation.allocationId} was signed by ${allocation.signer}, not by ${expected}`,
      )
    }
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
