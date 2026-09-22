import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

import { EInvoiceEscrowState, IInvoiceEscrowCorrection } from '@/model/invoice'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const BYTES32 = /^0x[\dA-Fa-f]{64}$/
/** A uint256 in decimal: digits, no sign, no leading zero. */
const BASE_UNITS = /^(0|[1-9]\d*)$/

/**
 * A settlement the marketplace pushed and this service acknowledged whose
 * refund beside it a reorganisation took back: see
 * `IInvoiceEscrowCorrection`. Signed like every internal call - HMAC over
 * this route and the re-serialised body - so the field order here is the
 * wire order of `test/fixture/marketplace-settlement-correction.contract.json`.
 */
export class MarketplaceSettlementCorrectionDto
  implements IInvoiceEscrowCorrection
{
  @IsUUID()
  invoiceId: string

  @IsInt()
  @Min(1)
  chainId: number

  @Matches(EVM_ADDRESS)
  escrow: string

  @Matches(BYTES32)
  allocationId: string

  /** The state the corrected settlement reported, and still does. */
  @IsEnum(EInvoiceEscrowState)
  escrowState: EInvoiceEscrowState

  @Matches(BASE_UNITS)
  @MaxLength(78)
  grossBaseUnits: string

  @Matches(BASE_UNITS)
  @MaxLength(78)
  feeBaseUnits: string

  @Matches(BASE_UNITS)
  @MaxLength(78)
  netBaseUnits: string

  /** What the settlement had refunded as it was pushed. */
  @Matches(BASE_UNITS)
  @MaxLength(78)
  refundedBaseUnits: string

  /** Its settling transaction, which the chain still holds. */
  @ValidateIf((dto: MarketplaceSettlementCorrectionDto) => dto.txHash !== null)
  @Matches(BYTES32)
  txHash: string | null

  /** What the chain has refunded now, the removed refund taken back. */
  @Matches(BASE_UNITS)
  @MaxLength(78)
  correctedRefundedBaseUnits: string

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
