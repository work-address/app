import { Badge, Flex } from '@radix-ui/themes'
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

  return (
    <Flex direction="column" gap="2" align="end">
      <Badge size="2" variant="soft" color={isPaid ? 'green' : 'amber'}>
        {t(isPaid ? 'invoice.state.paid' : 'invoice.state.requested')}
      </Badge>
      {canSettle ? (
        <>
          <Button
            size="l"
            variant={isPaid ? 'outline' : 'solid'}
            loading={pending}
            onClick={() =>
              isPaid ? markUnpaid(invoiceId) : markPaid(invoiceId)
            }
          >
            {t(isPaid ? 'invoice.payment.revert' : 'invoice.payment.markPaid')}
          </Button>
          <Text size="2" color="gray" align="right">
            {t(
              isPaid
                ? 'invoice.payment.revertNotice'
                : 'invoice.payment.markPaidNotice',
            )}
          </Text>
        </>
      ) : null}
    </Flex>
  )
}
