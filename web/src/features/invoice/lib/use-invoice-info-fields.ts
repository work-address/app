import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $invoice, getInvoiceInfoFields } from '../model'

import type { InvoiceInfoFieldRow } from '../model'

export const useInvoiceInfoFields = (): InvoiceInfoFieldRow[] => {
  const { t } = useTranslation()
  const invoice = useUnit($invoice)

  return getInvoiceInfoFields(invoice, t)
}
