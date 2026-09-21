export enum EUserRole {
  ROLE_USER = 'ROLE_USER',
}

export interface IUser {
  address: string
}

/** The chain an account's address belongs to, by its spelling. */
export enum EWalletChain {
  EVM = 'evm',
  TON = 'ton',
  SOLANA = 'solana',
}

/** What became of one entitlement push. */
export type TEntitlementOutcome = 'applied' | 'stale' | 'unknown'

/**
 * The answer to an entitlement push. `applied: false` is not a failure of
 * the request - it is a 200 - but it is not a delivery either: the account's
 * premium flag was left as it was. The billing service must not record such
 * a push as delivered, so the answer says why it was left alone.
 */
export interface IEntitlementPushResult {
  applied: boolean
  /**
   * Absent when applied. `stale`: the account already holds a newer
   * revision. `unknown`: this instance has no such account.
   */
  reason?: Exclude<TEntitlementOutcome, 'applied'>
  /**
   * With `stale`, the revision the account holds. A billing service whose
   * own counter has fallen behind it - restored from a backup, say - is
   * ignored until it passes this number, and this is how it finds out.
   */
  heldRevision?: number
}
