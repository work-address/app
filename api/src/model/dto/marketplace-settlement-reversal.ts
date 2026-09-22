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

import { EInvoiceEscrowState, IInvoiceEscrowReversal } from '@/model/invoice'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const BYTES32 = /^0x[\dA-Fa-f]{64}$/
/** A uint256 in decimal: digits, no sign, no leading zero. */
const BASE_UNITS = /^(0|[1-9]\d*)$/

/**
 * A settlement the marketplace pushed and this service acknowledged, which a
 * reorganisation has since taken off the chain: see `IInvoiceEscrowReversal`.
 * Signed like every internal call - HMAC over this route and the
 * re-serialised body - so the field order here is the wire order of
 * `test/fixture/marketplace-settlement-reversal.contract.json`.
 */
export class MarketplaceSettlementReversalDto
  implements IInvoiceEscrowReversal
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

  /** The state the reversed settlement reported. */
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

  @Matches(BASE_UNITS)
  @MaxLength(78)
  refundedBaseUnits: string

  /** The settling transaction the chain no longer holds; null for a remainder beside a pending bill. */
  @ValidateIf((dto: MarketplaceSettlementReversalDto) => dto.txHash !== null)
  @Matches(BYTES32)
  txHash: string | null

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
