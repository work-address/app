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

import { EInvoiceEscrowState, IInvoiceEscrowSettlement } from '@/model/invoice'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const BYTES32 = /^0x[\dA-Fa-f]{64}$/
/** A uint256 in decimal: digits, no sign, no leading zero. */
const BASE_UNITS = /^(0|[1-9]\d*)$/

/**
 * A confirmed MarketplaceEscrow outcome for the allocation an app invoice is
 * bound to, pushed by the marketplace (the web service's escrow indexer):
 * see `IInvoiceEscrowSettlement` for what each field means. Signed like the
 * hire - HMAC over the re-serialised body - so the field order here is the
 * wire order of `test/fixture/marketplace-settlement.contract.json`.
 */
export class MarketplaceSettlementDto implements IInvoiceEscrowSettlement {
  /** The app invoice the allocation bills; the idempotency key with the state. */
  @IsUUID()
  invoiceId: string

  @IsInt()
  @Min(1)
  chainId: number

  @Matches(EVM_ADDRESS)
  escrow: string

  @Matches(BYTES32)
  allocationId: string

  /** What the allocation holds on chain; null when no bill was submitted. */
  @ValidateIf((dto: MarketplaceSettlementDto) => dto.invoiceCommitment !== null)
  @Matches(BYTES32)
  invoiceCommitment: string | null

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

  /** The settling transaction; null while SUBMITTED. */
  @ValidateIf((dto: MarketplaceSettlementDto) => dto.txHash !== null)
  @Matches(BYTES32)
  txHash: string | null

  /** Unix seconds: the settling block's timestamp; null while SUBMITTED. */
  @ValidateIf((dto: MarketplaceSettlementDto) => dto.confirmedAt !== null)
  @IsInt()
  @Min(1)
  confirmedAt: number | null

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
