import { Address } from '@ton/core'
import { injectable } from 'inversify'

/** TON user-friendly address (EQ/UQ/kQ/0Q + 46 base64url chars). */
const TON_FRIENDLY = /^[0EKUk][Qq][\w-]{46}$/
/** TON raw address, e.g. `0:4a5d…`. */
const TON_RAW = /^-?\d+:[\dA-Fa-f]{64}$/
/**
 * EVM address, 0x-prefixed 40 hex chars.
 *
 * The prefix is matched case-insensitively: an address that has been
 * upper-cased whole reads `0XABC…`, and treating that as unrecognised would
 * make casing decide access.
 */
const EVM = /^0[Xx][\dA-Fa-f]{40}$/

/**
 * One canonical form for an address, and one display form.
 *
 * TON has two spellings of the same account - raw (`0:4a5d…`) and user-friendly
 * (`UQBKXR…`) - and a wallet only ever shows the friendly one. Access is granted
 * by string comparison against `User.address`, which holds the raw form, so a
 * collaborator address pasted straight out of Tonkeeper used to validate, save,
 * and then grant nothing. Canonicalising on the way in is what fixes that;
 * formatting on the way out is what stops us showing people a spelling their
 * wallet never uses.
 */
@injectable()
export class WalletAddress {
  /**
   * What gets written to the database.
   *
   * TON collapses to raw, because one account has several friendly spellings
   * (bounceable and not) and the column must hold exactly one of them.
   * Everything else is stored as typed - in particular an EVM address keeps its
   * EIP-55 checksum casing, which is a typo-detection mechanism and is lost the
   * moment it is lowercased.
   */
  public static toStorage(address: string): string {
    const value = address.trim()

    if (TON_FRIENDLY.test(value) || TON_RAW.test(value)) {
      try {
        return Address.parse(value).toRawString().toLowerCase()
      } catch {
        return value
      }
    }

    return value
  }

  /**
   * The form two addresses are compared on. Never stored - lowercasing an EVM
   * address here is safe precisely because the result is thrown away.
   *
   * Solana is deliberately left alone even for comparison: base58 is
   * case-sensitive, so two Solana addresses differing only in case really are
   * different accounts.
   */
  public static toCanonical(address: string): string {
    const value = address.trim()

    if (TON_FRIENDLY.test(value) || TON_RAW.test(value)) {
      try {
        return Address.parse(value).toRawString().toLowerCase()
      } catch {
        // Malformed despite matching the shape - a bad checksum, say. Left as
        // typed so validation reports it rather than this silently mangling it.
        return value
      }
    }

    if (EVM.test(value)) {
      return value.toLowerCase()
    }

    return value
  }

  /**
   * The form shown to a person. Non-bounceable for TON.
   *
   * Non-bounceable (`UQ…`) rather than bounceable (`EQ…`) because these are
   * addresses people are asked to *send funds to*: a transfer to a bounceable
   * address that is not an initialised contract is returned to the sender.
   * Wallets display `UQ` for the same reason.
   */
  public static toFriendly(address: string): string {
    const value = address.trim()

    if (TON_RAW.test(value) || TON_FRIENDLY.test(value)) {
      try {
        return Address.parse(value).toString({
          bounceable: false,
          urlSafe: true,
        })
      } catch {
        return value
      }
    }

    return value
  }

  /** Equality on the canonical form, so the two spellings compare equal. */
  public static isSame(a: string, b: string): boolean {
    return WalletAddress.toCanonical(a) === WalletAddress.toCanonical(b)
  }
}
