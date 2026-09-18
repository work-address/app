import {
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

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
