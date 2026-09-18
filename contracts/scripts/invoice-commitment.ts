import { concat, id, keccak256, toUtf8Bytes } from 'ethers'

/**
 * InvoiceCommitment v1: the `invoiceCommitment` a payee passes to
 * `MarketplaceEscrow.submitInvoice` / `submitInvoiceFor`. See the README,
 * "Canonical encodings".
 *
 *   commitment = keccak256(DOMAIN || salt || document)
 *
 * DOMAIN is keccak256 of the domain tag, salt is 32 random bytes the issuer
 * keeps, and document is the RFC 8785 (JCS) text of
 * `{ allocationId, chainId, escrow, record }` with `record` the app's
 * InvoiceRecord v1. The contract never opens it; a verifier holding the record
 * and the salt recomputes it from chain data alone.
 *
 * This is a second implementation of the app's `InvoiceCommitment`
 * (app/api/src/service/invoice-commitment.ts), kept here so the encoding can
 * be reproduced without the app. `test/fixtures/invoice-commitment.v1.json`,
 * a byte-identical copy of the app's vectors, holds both to the same bytes.
 */
export const INVOICE_COMMITMENT_DOMAIN_TAG = 'work-address/invoice-commitment/v1'

export const INVOICE_COMMITMENT_DOMAIN = id(INVOICE_COMMITMENT_DOMAIN_TAG)

/** One billed entry as the invoice froze it. Timestamps are ISO-8601 UTC with milliseconds. */
export type InvoiceRecordLine = {
  timeId: string
  fromAt: string
  toAt: string
  minutesActive: number
}

/** The app's InvoiceRecord v1 document: integers only, money in cents, time in minutes. */
export type InvoiceRecordV1 = {
  version: 1
  invoiceId: string
  projectId: string
  issuerId: string
  issuerAddress: string
  ownerAddress: string
  currency: string
  rateHourCents: number
  minutesActive: number
  amountCents: number
  periodStart: string
  periodEnd: string
  lines: InvoiceRecordLine[]
}

/** Which allocation of which escrow deployment on which chain the invoice is submitted to. */
export type InvoiceCommitmentBinding = {
  chainId: number | bigint
  escrow: string
  allocationId: string
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * RFC 8785 for the values a record holds: null, booleans, strings, safe
 * integers, arrays and plain objects. Keys sort by UTF-16 code unit, which is
 * what `Array.prototype.sort` does; strings and integers are written the way
 * `JSON.stringify` writes them, which is what RFC 8785 specifies. Anything
 * with more than one plausible text form is refused.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (typeof value === 'string') {
    if (/\p{Cs}/u.test(value)) {
      throw new TypeError('A string with a lone surrogate has no canonical form')
    }

    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Only safe integers are canonical here, got ${value}`)
    }

    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }

  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>

    return `{${Object.keys(object)
      .sort()
      .map((key) => `${canonicalJson(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`
  }

  throw new TypeError(`A ${typeof value} has no canonical JSON form`)
}

/** The exact text that is hashed, and that an opening discloses with the salt. */
export function invoiceCommitmentDocument(
  record: InvoiceRecordV1,
  binding: InvoiceCommitmentBinding,
): string {
  if (record.version !== 1) {
    throw new TypeError(`InvoiceCommitment v1 commits to an InvoiceRecord v1, got v${record.version}`)
  }

  const chainId = Number(binding.chainId)

  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new TypeError(`A chain id is a positive integer, got ${binding.chainId}`)
  }
  if (!ADDRESS.test(binding.escrow)) {
    throw new TypeError(`The escrow is an EVM address, got ${binding.escrow}`)
  }
  if (!BYTES32.test(binding.allocationId)) {
    throw new TypeError(`An allocation id is a bytes32, got ${binding.allocationId}`)
  }

  return canonicalJson({
    allocationId: binding.allocationId.toLowerCase(),
    chainId,
    escrow: binding.escrow.toLowerCase(),
    record,
  })
}

/** keccak256(DOMAIN || salt || document): Solidity's `keccak256(abi.encodePacked(DOMAIN, salt, bytes(document)))`. */
export function invoiceCommitment(
  record: InvoiceRecordV1,
  binding: InvoiceCommitmentBinding,
  salt: string,
): string {
  if (!BYTES32.test(salt) || BigInt(salt) === BigInt(0)) {
    throw new TypeError('A salt is 32 random bytes as 0x-prefixed hex, and never all zero')
  }

  return keccak256(
    concat([
      INVOICE_COMMITMENT_DOMAIN,
      salt,
      toUtf8Bytes(invoiceCommitmentDocument(record, binding)),
    ]),
  )
}
