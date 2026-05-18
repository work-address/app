import { sample } from 'effector'

import { fetchInvoice, resetInvoice } from './events'
import { activityDetailQuery, activityReportQuery } from './queries'

sample({
  clock: fetchInvoice,
  fn: ({ id }) => id,
  target: [activityDetailQuery.start, activityReportQuery.start],
})

sample({
  clock: resetInvoice,
  target: [activityDetailQuery.reset, activityReportQuery.reset],
})

export { fetchInvoice, resetInvoice } from './events'
export { $invoice, $invoiceWorklogs, $invoiceLoading } from './stores'
export type { ProjectInvoice } from './types'
