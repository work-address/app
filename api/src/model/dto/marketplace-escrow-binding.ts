import { IsInt, IsString, Matches, Min } from 'class-validator'

import { IInvoiceCommitmentBinding } from '@/model/invoice'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const BYTES32 = /^0x[\dA-Fa-f]{64}$/

/**
 * The marketplace asking which invoice this service bound to one escrow
 * allocation. Signed like every internal call - HMAC over this route and
 * the re-serialised body - so the field order here is the wire order of
 * `test/fixture/marketplace-escrow-binding.contract.json`.
 */
export class MarketplaceEscrowBindingDto implements IInvoiceCommitmentBinding {
  @IsInt()
  @Min(1)
  chainId: number

  @Matches(EVM_ADDRESS)
  escrow: string

  @Matches(BYTES32)
  allocationId: string

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
