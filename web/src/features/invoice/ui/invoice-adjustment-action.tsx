import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { canAdjustInvoice, issueInvoiceAdjustmentMutation } from '../model'

import { Button, Tooltip } from '@/shared'

type Props = {
  invoice: { id?: string; user?: { id?: string } | null } | null
  viewerId?: string | null
  stretch?: boolean
}

/**
 * Bills what this invoice missed as an adjustment (DEC-04): a new invoice,
 * naming this one, for the issuer's tracked time on the project that no
 * invoice covers yet. This invoice is never edited - the tooltip says so,
 * because "correct the invoice" reads like changing it.
 *
 * The issuer's alone, like the API: nothing to draw for anyone else.
 */
export const InvoiceAdjustmentAction = ({
  invoice,
  viewerId,
  stretch = false,
}: Props) => {
  const { t } = useTranslation()

  const { issue, pending } = useUnit({
    issue: issueInvoiceAdjustmentMutation.start,
    pending: issueInvoiceAdjustmentMutation.$pending,
  })

  if (!invoice?.id || !canAdjustInvoice(invoice, viewerId)) {
    return null
  }

  const invoiceId = invoice.id

  return (
    <Tooltip content={t('invoice.adjustment.hint')}>
      <Button
        variant={'soft'}
        color={'neutral'}
        loading={pending}
        stretch={stretch}
        onClick={() => issue(invoiceId)}
      >
        {t('invoice.adjustment.action')}
      </Button>
    </Tooltip>
  )
}
