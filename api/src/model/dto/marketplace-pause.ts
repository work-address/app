import { IsBoolean, IsInt, IsString, IsUUID, Min } from 'class-validator'

/**
 * The client paused a marketplace contract, or resumed it: the project it
 * opened stops taking new time, or takes it again.
 *
 * It says what the contract is now, not what happened, with a sequence
 * that counts the contract's pauses and resumes: a sequence this project
 * has already passed changes nothing, so a retry arriving after a later
 * move cannot undo it. The key order is the wire contract
 * (test/fixture/marketplace-pause.contract.json).
 */
export class MarketplacePauseDto {
  /** The marketplace contract whose project this is; the hire's key. */
  @IsUUID()
  contractId: string

  @IsBoolean()
  paused: boolean

  @IsInt()
  @Min(1)
  sequence: number

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
