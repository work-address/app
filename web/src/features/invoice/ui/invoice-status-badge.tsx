import { Badge } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { getInvoiceStatus, type InvoiceStatus } from '../model'

import type { InvoiceEscrowFields } from '../model'
import type { BadgeProps } from '@radix-ui/themes'

const STATUS: Record<
  InvoiceStatus,
  { color: BadgeProps['color']; labelKey: string }
> = {
  paid: { color: 'green', labelKey: 'invoice.state.paid' },
  requested: { color: 'amber', labelKey: 'invoice.state.requested' },
  refunded: { color: 'red', labelKey: 'invoice.state.refunded' },
}

type Props = {
  invoice:
    | (Pick<InvoiceEscrowFields, 'escrowState'> & { state?: string })
    | null
    | undefined
}

/**
 * Paid, awaiting payment, or refunded - the last when the escrow gave the
 * money back, so a disputed bill is not shown as still owed. It prints: a PDF
 * that does not say whether it was paid is only half a record.
 */
export const InvoiceStatusBadge = ({ invoice }: Props) => {
  const { t } = useTranslation()
  const status = STATUS[getInvoiceStatus(invoice)]

  return (
    <Badge size="2" variant="soft" color={status.color}>
      {t(status.labelKey)}
    </Badge>
  )
}
