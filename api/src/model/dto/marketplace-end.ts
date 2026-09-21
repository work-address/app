import { IsInt, IsString, IsUUID } from 'class-validator'

/**
 * A marketplace contract has ended, so the project it opened stops taking
 * new time. Nothing already recorded is touched: the hours worked, and the
 * invoices that bill them, are the record of what happened and survive the
 * contract that produced them.
 *
 * Carries the contract id alone - the same idempotency key the hire used -
 * because ending is not a new agreement and has no terms of its own.
 */
export class MarketplaceEndDto {
  /** The marketplace contract whose project closes; the idempotency key. */
  @IsUUID()
  contractId: string

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
