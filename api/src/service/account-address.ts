import { injectable } from 'inversify'

/** EVM address, 0x-prefixed 40 hex chars. The prefix may be upper-cased too. */
const EVM = /^0[Xx][\dA-Fa-f]{40}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * What an account is called: an EVM address for a wallet account, or the email
 * Google gave for a Google account. Access is granted by comparing these, and
 * project lists can hold one before its account exists.
 */
@injectable()
export class AccountAddress {
  public static isEvm(address: string): boolean {
    return EVM.test(address.trim())
  }

  public static isEmail(address: string): boolean {
    return EMAIL.test(address.trim())
  }

  /**
   * What gets written to the database. An email is lowercase; an EVM address
   * keeps its EIP-55 checksum casing, a typo-detection mechanism that is lost
   * the moment it is lowercased.
   */
  public static toStorage(address: string): string {
    const value = address.trim()

    return AccountAddress.isEmail(value) ? value.toLowerCase() : value
  }

  /**
   * The form two addresses are compared on. Never stored, which is what makes
   * lowercasing an EVM address safe here.
   */
  public static toCanonical(address: string): string {
    return address.trim().toLowerCase()
  }

  /** `toCanonical` for a stored address, in SQL. */
  public static canonicalSql(column: string): string {
    return `lower(btrim(${column}))`
  }

  public static isSame(a: string, b: string): boolean {
    return AccountAddress.toCanonical(a) === AccountAddress.toCanonical(b)
  }
}
