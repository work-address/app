export type InvoiceSortOrder = 'ASC' | 'DESC'

/** The names the invoice search sorts by; each is a column of the list. */
export type InvoiceSortField =
  | 'projectName'
  | 'state'
  | 'issuedBy'
  | 'fromAt'
  | 'createdAt'
  | 'amountCents'

export type InvoiceSort = Partial<Record<InvoiceSortField, InvoiceSortOrder>>

/** Newest first: the list's opening order, and what the query falls back to. */
export const DEFAULT_INVOICE_SORT: InvoiceSort = { createdAt: 'DESC' }

/**
 * Every column the list can be ordered by, in the order the table shows them.
 * One list for the table's headers and the phone's picker, so neither offers a
 * sort the other could not undo.
 */
export const INVOICE_SORT_FIELDS: {
  field: InvoiceSortField
  labelKey: string
}[] = [
  { field: 'projectName', labelKey: 'invoices.item.project' },
  { field: 'state', labelKey: 'invoices.item.status' },
  { field: 'issuedBy', labelKey: 'invoices.item.issuedBy' },
  { field: 'fromAt', labelKey: 'invoices.item.period' },
  { field: 'createdAt', labelKey: 'invoices.item.issued' },
  { field: 'amountCents', labelKey: 'invoices.item.amount' },
]
