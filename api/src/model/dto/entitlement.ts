import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator'

/**
 * One assertion of an account's current entitlement, pushed by the billing
 * service. Carries the whole current state rather than a delta, so a replayed
 * or duplicated push is a no-op and the reconciliation sweep can re-assert
 * everything without tracking what it has already sent.
 *
 * Declared in wire order: the signature covers the bytes billing sent, and
 * the controller re-serialises this object to check it (see the contract
 * fixture).
 */
export class EntitlementPushDto {
  /**
   * The billing service has no user table of its own - it reads `{ id, address }`
   * from a token this service issued, so `Subscription.ownerId` there is this
   * service's `User.id`. No address mapping is involved.
   */
  @IsUUID()
  userId: string

  @IsBoolean()
  premium: boolean

  /**
   * Monotonic per account. A push with a lower revision than the account
   * holds was overtaken in flight and is ignored; an equal one is the sweep
   * re-asserting the same state and is applied.
   */
  @IsInt()
  @Min(0)
  revision: number

  /**
   * ISO-8601 instant the grant lapses without further news. In SaaS mode an
   * account stops being premium after it, whatever the flag says, so a
   * billing service that goes quiet costs a lapse rather than premium
   * forever.
   */
  @IsOptional()
  @IsISO8601()
  validUntil: string | null

  /** Unix seconds. Outside the replay window the push is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
