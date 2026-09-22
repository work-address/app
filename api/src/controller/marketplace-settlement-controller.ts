import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import {
  IInvoiceEscrowBindingResult,
  IInvoiceEscrowReversalResult,
  IInvoiceEscrowSettlementResult,
} from '@/model/invoice'
import { MarketplaceEscrowBindingDto } from '@/model/dto/marketplace-escrow-binding'
import { MarketplaceSettlementDto } from '@/model/dto/marketplace-settlement'
import { MarketplaceSettlementReversalDto } from '@/model/dto/marketplace-settlement-reversal'
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
 * so a retry signed afresh answers 200 and changes nothing twice. A
 * settlement the chain takes back in a reorganisation after it was recorded
 * here is undone through the reversal route beside it, and the invoice an
 * allocation bills, when the marketplace never recorded it, is asked for
 * through the binding route. Under `/internal`, so the public API spec and
 * the browser clients leave it out.
 */
@JsonController('/internal')
export class MarketplaceSettlementController {
  public static readonly SIGNATURE_HEADER = InternalRoute.SETTLEMENT.header

  /**
   * The reversal's own header: a captured settlement push must never be
   * replayable as the reversal of the payment it recorded.
   */
  public static readonly REVERSAL_SIGNATURE_HEADER =
    InternalRoute.SETTLEMENT_REVERSAL.header

  /** The binding lookup's own header, like every internal route's. */
  public static readonly BINDING_SIGNATURE_HEADER =
    InternalRoute.ESCROW_BINDING.header

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

  /**
   * A settlement recorded here that a reorganisation has since taken off the
   * chain: the invoice stops recording it, and one it had made PAID is
   * unpaid again with its hours. Authenticated like the push, under its own
   * header; idempotent, and it only ever undoes the settlement it names
   * (`InvoiceManager.reverseEscrowSettlement`).
   */
  @HttpCode(200)
  @Post('/marketplace/settlement-reversal')
  public async reverse(
    @Body() data: MarketplaceSettlementReversalDto,
    @Req() request: express.Request,
  ): Promise<IInvoiceEscrowReversalResult> {
    const signature =
      request.header(
        MarketplaceSettlementController.REVERSAL_SIGNATURE_HEADER,
      ) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.SETTLEMENT_REVERSAL,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace settlement reversal outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException(
        'Marketplace settlement reversal nonce already used',
      )
    }

    return runPromise(this.invoiceManager.reverseEscrowSettlement(data))
  }

  /**
   * Which invoice this service bound to an allocation: asked by the
   * marketplace for an allocation with a settlement to push and no invoice
   * recorded there, because the payee's recording of the binding never
   * reached it (`InvoiceManager.escrowBindingOf`). Authenticated like the
   * push, under its own header; reads only.
   */
  @HttpCode(200)
  @Post('/marketplace/escrow-binding')
  public async binding(
    @Body() data: MarketplaceEscrowBindingDto,
    @Req() request: express.Request,
  ): Promise<IInvoiceEscrowBindingResult> {
    const signature =
      request.header(
        MarketplaceSettlementController.BINDING_SIGNATURE_HEADER,
      ) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.ESCROW_BINDING,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace escrow binding lookup outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException(
        'Marketplace escrow binding lookup nonce already used',
      )
    }

    return runPromise(this.invoiceManager.escrowBindingOf(data))
  }
}
