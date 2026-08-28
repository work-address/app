import { IsBoolean, IsInt, IsOptional, IsString, IsUUID } from 'class-validator'

/**
 * One assertion of an account's current entitlement, pushed by the billing
 * service. Carries the whole current state rather than a delta, so a replayed
 * or duplicated push is a no-op and the reconciliation sweep can re-assert
 * everything without tracking what it has already sent.
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

  /** Unix seconds. Outside the replay window the push is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string

  /** Informational: when the current paid period ends. Not enforced here. */
  @IsOptional()
  @IsString()
  expiresAt?: string | null
}
