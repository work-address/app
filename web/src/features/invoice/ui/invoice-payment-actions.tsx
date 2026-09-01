import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { markInvoicePaidMutation, markInvoiceUnpaidMutation } from '../model'

import { Button, Text, showToast } from '@/shared'

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
  onChanged,
}: {
  invoiceId: string
  isPaid: boolean
  canSettle: boolean
  onChanged?: () => void
}) => {
  const { t } = useTranslation()

  const { markPaid, markUnpaid, paidStatus, unpaidStatus, pending } = useUnit({
    markPaid: markInvoicePaidMutation.start,
    markUnpaid: markInvoiceUnpaidMutation.start,
    paidStatus: markInvoicePaidMutation.$status,
    unpaidStatus: markInvoiceUnpaidMutation.$status,
    pending: markInvoicePaidMutation.$pending,
  })

  useEffect(() => {
    if (paidStatus === 'done' || unpaidStatus === 'done') {
      onChanged?.()
      showToast('success', {
        message: t(
          paidStatus === 'done'
            ? 'invoice.payment.markedPaid'
            : 'invoice.payment.markedUnpaid',
        ),
        position: 'top-center',
      })
    }
  }, [paidStatus, unpaidStatus, onChanged, t])

  // Nothing to draw for anyone but the issuer. The status itself is shown by
  // whoever renders this, so a viewer costs no height at all.
  if (!canSettle) {
    return null
  }

  return (
    <Flex align="center" justify="end" gap="3" wrap="wrap">
      {/* Beside the button rather than beneath it: an issuer who does not
          realise the hours move too will wonder why they stop appearing on
          the next invoice, so the copy stays - it just costs no extra line. */}
      <Text size="1" color="gray" align="right">
        {t(
          isPaid
            ? 'invoice.payment.revertNotice'
            : 'invoice.payment.markPaidNotice',
        )}
      </Text>
      <Button
        size="m"
        variant={isPaid ? 'outline' : 'solid'}
        loading={pending}
        onClick={() => (isPaid ? markUnpaid(invoiceId) : markPaid(invoiceId))}
      >
        {t(isPaid ? 'invoice.payment.revert' : 'invoice.payment.markPaid')}
      </Button>
    </Flex>
  )
}
