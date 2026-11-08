import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

import { FREE_PLAN_WORKERS } from '@/model/plan'

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

/** A signed question from billing: who is on this owner's bill? */
export class SeatInventoryRequestDto {
  @IsUUID()
  userId: string

  /** Start of the period to find the highest count in, as an ISO date. */
  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}

/** The workers an owner with no plan keeps tracking with. */
export class KeptWorkersDto {
  @IsArray()
  @ArrayMaxSize(FREE_PLAN_WORKERS)
  @IsString({ each: true })
  addresses: string[]
}

export class TrackingWorkerDto {
  @IsString()
  address: string

  @IsOptional()
  @IsString()
  name: string | null

  @IsBoolean()
  connected: boolean

  @IsBoolean()
  tracking: boolean
}

/** Where an owner stands against the free plan's worker limit. */
export class TrackingWorkersDto {
  /** Whether workers outside the free limit can't track right now. */
  @IsBoolean()
  limited: boolean

  @IsInt()
  limit: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackingWorkerDto)
  workers: TrackingWorkerDto[]
}
