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
 * A contract whose terms were amended has more than one such hash: a period
 * funded before the amendment keeps the hash of the terms it was funded
 * under, for good. The certificate therefore discloses every version of the
 * terms (`versions`, oldest first), and each allocation is opened with the
 * version whose bytes hash to the `termsHash` it carries. An allocation
 * fails only when no disclosed version opens it; a version fails when its
 * bytes do not hash to what it claims, or name another engagement.
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
  /**
   * Whether the payee may bill from `workStart` rather than `workEnd`: true
   * for a fixed-price milestone, false for an hourly period. Part of the
   * signed terms since the escrow learned milestones; a certificate issued
   * before that names no such field in its `types` and carries none here.
   */
  earlySubmission?: boolean
  signature: string
}

/** One version of the contract's terms, as the certificate discloses it. */
export type OriginTermsVersion = {
  /** 1 for the terms the hire began on, one more per accepted amendment. */
  termsVersion: number
  /** ISO instant these terms applied from; null for the ones hired on. */
  effectiveFrom: string | null
  /** 2 when `preimage` carries an `origin` block, 1 for a legacy contract. */
  version: number | null
  preimage: Record<string, unknown>
  termsHash: string
}

export type OriginCertificate = {
  contractId: string
  /** 2 when `preimage` carries an `origin` block, 1 for a legacy contract. */
  version: number | null
  /** The terms in force: the last of `versions`, where there are any. */
  preimage: Record<string, unknown>
  termsHash: string
  /**
   * Every version of the terms, oldest first. Absent on a certificate saved
   * before amendments were disclosed, which is then read as its one preimage.
   */
  versions?: OriginTermsVersion[]
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
  /** A disclosed preimage hashes to the allocation's own `termsHash`. */
  termsHashMatches: boolean
  /** Which disclosed version that is; null when none, or on an old certificate. */
  termsVersion: number | null
}

export type VersionVerdict = {
  termsVersion: number | null
  effectiveFrom: string | null
  /** keccak256 of this version's preimage, re-serialised here. */
  termsHash: string
  /** That hash is the one the certificate claims for this version. */
  termsHashMatches: boolean
  /** Where the hire came from; null on a v1 preimage, which names none. */
  origin: TermsOrigin | null
  /**
   * It names the contract the certificate is for and, where it names an
   * origin at all, the same one as the terms in force: amending the price
   * does not change who hired whom, so a version that says otherwise is
   * another engagement's terms slipped in.
   */
  sameEngagement: boolean
}

export type OriginVerdict = {
  contractId: string
  /** keccak256 of the certificate's preimage, re-serialised here. */
  termsHash: string
  /** That hash is the one the certificate claims was signed. */
  termsHashMatches: boolean
  /** Where the hire came from; null on a v1 certificate, which names none. */
  origin: TermsOrigin | null
  /** Every disclosed version of the terms, oldest first. */
  versions: VersionVerdict[]
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
 * Every version the certificate discloses, oldest first. One that carries no
 * `versions` is read as the single preimage it has; on one that does, the
 * certificate's own preimage is a copy of the last version and is checked
 * separately, as the terms in force.
 */
export function disclosedVersions(
  certificate: OriginCertificate,
): OriginTermsVersion[] {
  if (certificate.versions?.length) {
    return certificate.versions
  }

  return [
    {
      termsVersion: 1,
      effectiveFrom: null,
      version: certificate.version,
      preimage: certificate.preimage,
      termsHash: certificate.termsHash,
    },
  ]
}

/** One disclosed version: its bytes re-hashed, and whose terms they are. */
export function verifyVersion(
  certificate: OriginCertificate,
  version: OriginTermsVersion,
): VersionVerdict {
  const termsHash = termsHashOf(version.preimage)
  const origin = originOf(version.preimage)
  const inForce = originOf(certificate.preimage)

  return {
    termsVersion: version.termsVersion ?? null,
    effectiveFrom: version.effectiveFrom ?? null,
    termsHash,
    termsHashMatches:
      termsHash.toLowerCase() === version.termsHash.toLowerCase(),
    origin,
    sameEngagement:
      version.preimage.contractId === certificate.contractId &&
      (origin === null ||
        inForce === null ||
        JSON.stringify(origin) === JSON.stringify(inForce)),
  }
}

/**
 * The digest and the signer of one allocation, and which of `versions` opens
 * the hash it carries. The domain is rebuilt from the allocation's own chain
 * and escrow, so a signature made for one deployment cannot pass as one made
 * for another. The match is against the hash computed here from each
 * version's bytes, never the one the certificate claims for it.
 */
export function verifyAllocation(
  certificate: OriginCertificate,
  allocation: OriginAllocation,
  versions: VersionVerdict[],
): AllocationVerdict {
  const opened = versions.find(
    (version) =>
      version.termsHash.toLowerCase() === allocation.termsHash.toLowerCase(),
  )
  const domain = {
    ...certificate.domain,
    chainId: allocation.chainId,
    verifyingContract: allocation.escrowAddress,
  }
  const terms = signedTermsOf(certificate, allocation)

  return {
    allocationId: allocation.allocationId,
    digest: TypedDataEncoder.hash(domain, certificate.types, terms),
    signer: verifyTypedData(
      domain,
      certificate.types,
      terms,
      allocation.signature,
    ),
    termsHashMatches: opened !== undefined,
    termsVersion: opened?.termsVersion ?? null,
  }
}

/**
 * The struct the origin signer signed, rebuilt field by field from the
 * `Terms` type the certificate itself declares. The escrow's terms have
 * grown a field before (earlySubmission) and may again, so the verifier
 * follows the certificate rather than a list of its own: a certificate from
 * either side of such a change opens, and one whose allocation lacks a
 * field its own type names is refused by name instead of hashing to
 * something the signer never signed.
 */
function signedTermsOf(
  certificate: OriginCertificate,
  allocation: OriginAllocation,
): Record<string, unknown> {
  const fields = certificate.types.Terms

  if (!fields) {
    throw new Error('The certificate declares no Terms type to verify against')
  }

  const carried = allocation as unknown as Record<string, unknown>

  return Object.fromEntries(
    fields.map(({ name }) => {
      if (carried[name] === undefined) {
        throw new Error(
          `The certificate's Terms type names "${name}", which allocation ${allocation.allocationId} does not carry`,
        )
      }

      return [name, carried[name]]
    }),
  )
}

/** Every check the certificate allows, with no network and no trust. */
export function verifyOrigin(certificate: OriginCertificate): OriginVerdict {
  const termsHash = termsHashOf(certificate.preimage)
  const versions = disclosedVersions(certificate).map((version) =>
    verifyVersion(certificate, version),
  )

  return {
    contractId: certificate.contractId,
    termsHash,
    termsHashMatches:
      termsHash.toLowerCase() === certificate.termsHash.toLowerCase(),
    origin: originOf(certificate.preimage),
    versions,
    allocations: certificate.allocations.map((allocation) =>
      verifyAllocation(certificate, allocation, versions),
    ),
  }
}

/**
 * Why the certificate does not hold up, one line per failure; empty when it
 * does. With `expectedSigner`, a recovered address that is not it is one.
 */
export function failuresOf(
  certificate: OriginCertificate,
  verdict: OriginVerdict,
  expectedSigner?: string,
): string[] {
  const failures: string[] = []

  if (!verdict.termsHashMatches) {
    failures.push(
      `The disclosed terms hash to ${verdict.termsHash}, not to the ${certificate.termsHash} the certificate claims was signed`,
    )
  }

  for (const version of verdict.versions) {
    if (!version.termsHashMatches) {
      failures.push(
        `Version ${version.termsVersion} of the terms hashes to ${version.termsHash}, not to the hash the certificate claims for it`,
      )
    }

    if (!version.sameEngagement) {
      failures.push(
        `Version ${version.termsVersion} of the terms names another engagement than the certificate is for`,
      )
    }
  }

  for (const allocation of verdict.allocations) {
    if (!allocation.termsHashMatches) {
      failures.push(
        `Allocation ${allocation.allocationId} was signed over terms the certificate does not disclose`,
      )
    }

    if (
      expectedSigner &&
      allocation.signer.toLowerCase() !== expectedSigner.toLowerCase()
    ) {
      failures.push(
        `Allocation ${allocation.allocationId} was signed by ${allocation.signer}, not by ${expectedSigner}`,
      )
    }
  }

  return failures
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
  const failures = failuresOf(certificate, verdict, process.env.ORIGIN_SIGNER)

  console.log(JSON.stringify(verdict, null, 2))

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
