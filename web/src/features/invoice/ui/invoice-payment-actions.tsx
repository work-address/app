import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoiceSettlementPendingIds,
  invoiceSettlementRequested,
} from '../model'

import { Button, Tooltip } from '@/shared'

/**
 * Whether this invoice has been settled, and the control to say so.
 *
 * Only the issuer sees the control: the person owed the money is the one who
 * knows whether it arrived, so the owner and viewers of a project get the
 * status but not the switch.
 *
 * Marking paid also marks the hours behind it paid, server-side. The copy says
 * so, because an issuer who does not realise it will wonder why those hours
 * stop appearing on their next invoice.
 */
export const InvoicePaymentActions = ({
  invoiceId,
  isPaid,
  canSettle,
  disabled = false,
  variant,
  compact = true,
  stretch = false,
}: {
  invoiceId: string
  isPaid: boolean
  canSettle: boolean
  disabled?: boolean
  variant?: 'solid' | 'outline' | 'soft'
  /**
   * The list row squeezes the button below the `s`/`m`/`l` scale; the invoice
   * page sits it beside Share and Save PDF, where it takes their size.
   */
  compact?: boolean
  stretch?: boolean
}) => {
  const { t } = useTranslation()

  const { pendingIds, requestSettlement } = useUnit({
    pendingIds: $invoiceSettlementPendingIds,
    requestSettlement: invoiceSettlementRequested,
  })
  const pending = Boolean(pendingIds[invoiceId])

  // Nothing to draw for anyone but the issuer. The status itself is shown by
  // whoever renders this, so a viewer costs no height at all.
  if (!canSettle) {
    return null
  }

  return (
    /* The notice rides on the button rather than sitting beside it. An issuer
       who does not realise the hours move too will wonder why they stop
       appearing on the next invoice, so the copy stays - but as a full
       sentence in the row it was the longest thing on the card. */
    <Tooltip
      content={t(
        isPaid
          ? 'invoice.payment.revertNotice'
          : 'invoice.payment.markPaidNotice',
      )}
    >
      <SettleButton
        size={compact ? 'l' : 'm'}
        variant={variant ?? (isPaid ? 'outline' : 'solid')}
        loading={pending}
        disabled={disabled}
        stretch={stretch}
        data-compact={compact || undefined}
        onClick={() => requestSettlement({ id: invoiceId, isPaid: !isPaid })}
      >
        {t(isPaid ? 'invoice.payment.revert' : 'invoice.payment.markPaid')}
      </SettleButton>
    </Tooltip>
  )
}

/**
 * Sized outside the `s`/`m`/`l` scale.
 *
 * The list row is dense and this sits beside the figures rather than under
 * them, so it is shorter than `s` (24px tall, but with roomier padding than
 * the preset gives) while keeping body-sized text.
 */
const SettleButton = styled(Button)`
  /* Stays above a card-wide link overlay, so pressing it settles the invoice
     rather than navigating to it (see the invoices list). */
  position: relative;
  z-index: 1;

  &&[data-compact] {
    height: 26px;
    min-height: 26px;
    padding: 0 14px;
    font-size: 14px;
    border-radius: 5px;
  }
`
