import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

/**
 * A client hired a freelancer on the marketplace (the web service): open the
 * project they will track against. Ids are this service's `User.id`, the same
 * ids the marketplace reads from tokens issued here.
 */
export class MarketplaceHireDto {
  /** The marketplace contract; the idempotency key. */
  @IsUUID()
  contractId: string

  @IsUUID()
  clientId: string

  @IsUUID()
  freelancerId: string

  /** Fallback when the freelancer has no account on this instance yet. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  freelancerAddress?: string | null

  @IsString()
  @MaxLength(200)
  title: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string | null

  /** Agreed hourly rate; 0 for fixed-price work. */
  @IsNumber()
  @Min(0)
  @Max(9999)
  rateHour: number

  /**
   * Hours a week the contract caps the freelancer at, as the offer they
   * accepted names it; null when the offer set none. Stored on the project
   * and enforced there, so the cap the freelancer agreed to is the cap the
   * tracker applies rather than one re-entered by hand.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  weeklyLimit?: number | null

  /**
   * What the tracker is asked to record, as the freelancer accepted it.
   * Absent on a hire sent before the marketplace carried them, which is why
   * both are optional and default to off: no flag means no monitoring, never
   * monitoring nobody agreed to.
   */
  @IsOptional()
  @IsBoolean()
  trackScreenshots?: boolean

  @IsOptional()
  @IsBoolean()
  trackProcesses?: boolean

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
