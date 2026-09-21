import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import { IInvoiceEscrowSettlementResult } from '@/model/invoice'
import { MarketplaceSettlementDto } from '@/model/dto/marketplace-settlement'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { InvoiceManager } from '@/service/invoice-manager'
import { runPromise } from '@/service/effect-bridge'
import AuthenticationException from '@/exception/authentication-exception'

/**
 * Service-to-service settlement from the marketplace: the escrow indexer in
 * the web service has confirmed how the allocation an app invoice is bound to
 * settled - released, refunded on dispute, expired or cancelled - and this
 * records it on that invoice. A release is what makes an escrow-bound invoice
 * PAID; nothing else does.
 *
 * Authenticated exactly like the marketplace hire - HMAC with the shared
 * secret over this route and the re-serialised body, a replay window and a
 * one-time nonce - so a signed hire cannot be sent here or the other way
 * round. Idempotent: the push carries the allocation's absolute state,
 * so a retry signed afresh answers 200 and changes nothing twice. Under
 * `/internal`, so the public API spec and the browser clients leave it out.
 */
@JsonController('/internal')
export class MarketplaceSettlementController {
  public static readonly SIGNATURE_HEADER = InternalRoute.SETTLEMENT.header

  protected signature: EntitlementSignature
  protected invoiceManager: InvoiceManager

  constructor() {
    this.signature = App.container.get('EntitlementSignature')
    this.invoiceManager = App.container.get('InvoiceManager')
  }

  @HttpCode(200)
  @Post('/marketplace/settlement')
  public async settle(
    @Body() data: MarketplaceSettlementDto,
    @Req() request: express.Request,
  ): Promise<IInvoiceEscrowSettlementResult> {
    const signature =
      request.header(MarketplaceSettlementController.SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.SETTLEMENT,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace settlement outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException(
        'Marketplace settlement nonce already used',
      )
    }

    return runPromise(this.invoiceManager.recordEscrowSettlement(data))
  }
}
