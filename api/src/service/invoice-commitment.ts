import { injectable } from 'inversify'
import * as web3 from 'web3'

import { IInvoiceCommitmentBinding, IInvoiceRecord } from '@/model/invoice'
import { CanonicalJson } from '@/service/canonical-json'
import { InvoiceRecord } from '@/service/invoice-record'

const BYTES32 = /^0x[\dA-Fa-f]{64}$/
const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`

/**
 * InvoiceCommitment v1: the bytes32 a worker submits to MarketplaceEscrow in
 * place of the invoice itself.
 *
 *   commitment = keccak256(DOMAIN || salt || document)
 *
 *  - DOMAIN is keccak256 of the UTF-8 text `work-address/invoice-commitment/v1`
 *    (32 bytes). It keeps these preimages apart from every other keccak256
 *    the product computes, and a v2 gets its own
 *  - salt is 32 bytes the issuer draws at random and keeps. Without it the
 *    commitment is a guessable hash of public ids, which is what the formula
 *    this replaces was (`work-address:invoice:<contract>:<allocation>:<amount>`)
 *  - document is the RFC 8785 (JCS) text of `{ allocationId, chainId, escrow,
 *    record }`, with `record` the invoice's InvoiceRecord v1. JCS nests, so
 *    the record's own serialisation appears in the document verbatim
 *
 * All three parts have a fixed length or run to the end, so the concatenation
 * is unambiguous, and Solidity computes the same value as
 * `keccak256(abi.encodePacked(DOMAIN, salt, bytes(document)))`.
 *
 * The chain id, escrow and allocation are committed so an opening proves where
 * the invoice was submitted, not only what it said. The on-chain amount is not:
 * the escrow binds that itself, and the payee's relayed signature covers it.
 *
 * `api/src/test/fixture/invoice-commitment.v1.json` holds the vectors, and a
 * byte-identical copy in the contracts repository's `test/fixtures` is checked
 * against MarketplaceEscrow. A change that moves one byte of any output needs
 * a new version, not an edit.
 */
@injectable()
export class InvoiceCommitment {
  public static readonly VERSION = 1
  public static readonly DOMAIN_TAG = 'work-address/invoice-commitment/v1'
  public static readonly DOMAIN = web3.utils.keccak256(
    Buffer.from(InvoiceCommitment.DOMAIN_TAG, 'utf8'),
  )

  /** The commitment to `record` for the allocation in `binding`, under `salt`. */
  public commit(
    record: IInvoiceRecord,
    binding: IInvoiceCommitmentBinding,
    salt: string,
  ): string {
    return web3.utils.keccak256(
      Buffer.concat([
        InvoiceCommitment.bytes(InvoiceCommitment.DOMAIN),
        InvoiceCommitment.bytes(InvoiceCommitment.salt(salt)),
        Buffer.from(this.document(record, binding), 'utf8'),
      ]),
    )
  }

  /**
   * The canonical text that is hashed - what an opening discloses besides the
   * salt, and what a verifier re-hashes.
   */
  public document(
    record: IInvoiceRecord,
    binding: IInvoiceCommitmentBinding,
  ): string {
    if (record.version !== InvoiceRecord.VERSION) {
      throw new TypeError(
        `InvoiceCommitment v${InvoiceCommitment.VERSION} commits to an InvoiceRecord v${InvoiceRecord.VERSION}, got v${record.version}`,
      )
    }

    return CanonicalJson.stringify({
      allocationId: InvoiceCommitment.allocationId(binding.allocationId),
      chainId: InvoiceCommitment.chainId(binding.chainId),
      escrow: InvoiceCommitment.escrow(binding.escrow),
      record,
    })
  }

  private static chainId(value: number): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`A chain id is a positive integer, got ${value}`)
    }

    return value
  }

  private static escrow(value: string): string {
    if (!EVM_ADDRESS.test(value)) {
      throw new TypeError(`The escrow is an EVM address, got ${value}`)
    }

    return value.toLowerCase()
  }

  private static allocationId(value: string): string {
    if (!BYTES32.test(value)) {
      throw new TypeError(`An allocation id is a bytes32, got ${value}`)
    }

    return value.toLowerCase()
  }

  /**
   * Exactly 32 bytes, and never all zero: a zero salt is no salt, and would
   * let anyone holding the record and the public ids recompute the
   * commitment.
   */
  private static salt(value: string): string {
    if (!BYTES32.test(value)) {
      throw new TypeError('A salt is 32 bytes, as 0x-prefixed hex')
    }

    if (value === ZERO_BYTES32) {
      throw new TypeError('A salt of all zeroes is no salt')
    }

    return value
  }

  private static bytes(hex: string): Buffer {
    return Buffer.from(hex.slice(2), 'hex')
  }
}
