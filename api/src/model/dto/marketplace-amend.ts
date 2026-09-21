import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator'

/**
 * Highest unix second a start may name. Past it `new Date` loses precision,
 * and no agreement takes effect in the year 275760.
 */
const MAX_UNIX_SECONDS = 8640000000000

/**
 * Both sides of a marketplace contract agreed a new version of its terms,
 * and it has now taken effect: the same project applies the new rate,
 * weekly cap and monitoring from `effectiveFrom`.
 *
 * Hours worked before then keep the rate agreed for them, and an invoice
 * already issued is never touched - the project remembers every version
 * it was told about rather than overwriting the one it had.
 *
 * The key order is the wire contract
 * (test/fixture/marketplace-amend.contract.json): the signature is checked
 * over this DTO re-serialised, so every field is declared, in that order.
 */
export class MarketplaceAmendDto {
  /** The marketplace contract whose project this is; the hire's key. */
  @IsUUID()
  contractId: string

  /** The contract's terms version this makes current; 2 for the first. */
  @IsInt()
  @Min(2)
  version: number

  /** Unix second the new terms apply from. */
  @IsInt()
  @Min(0)
  @Max(MAX_UNIX_SECONDS)
  effectiveFrom: number

  /** Agreed hourly rate; 0 for fixed-price work. */
  @IsNumber()
  @Min(0)
  @Max(9999)
  rateHour: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  weeklyLimit: number | null

  @IsBoolean()
  trackScreenshots: boolean

  @IsBoolean()
  trackProcesses: boolean

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
