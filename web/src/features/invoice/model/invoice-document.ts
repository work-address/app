import { formatCents } from './format'
import { getInvoiceStatus } from './invoice-escrow'

import type { InvoiceEscrowFields } from './invoice-escrow'
import type { InvoiceRead } from './types'

type Translate = (key: string, params?: Record<string, unknown>) => string

/** The facts a printed invoice states about itself, in the order it prints them. */
export type InvoiceDocumentFieldId =
  | 'from'
  | 'billTo'
  | 'reference'
  | 'period'
  | 'currency'
  | 'amount'
  | 'status'
  | 'paidOn'
  | 'milestone'
  | 'corrects'

export type InvoiceDocumentField = {
  id: InvoiceDocumentFieldId
  /** Resolved label. */
  label: string
  value: string
  /** A second line under the value: a party's wallet address. */
  detail?: string
}

type Party = { name?: string; company?: string; address?: string } | null

export type InvoiceDocumentSource = Pick<
  InvoiceRead,
  | 'id'
  | 'fromAt'
  | 'toAt'
  | 'amountCents'
  | 'currency'
  | 'issuerAddress'
  | 'ownerAddress'
  | 'paidAt'
  | 'milestoneRef'
  | 'state'
> &
  InvoiceEscrowFields & {
    user?: Party
    project?: { user?: Party } | null
    /** The invoice this one corrects, when it is an adjustment. */
    correctsInvoiceId?: string | null
  }

/** A party as the document names them: their name, else their company. */
const nameOf = (party: Party | undefined, t: Translate): string =>
  party?.name?.trim() || party?.company?.trim() || t('invoice.document.unnamed')

/**
 * The header of the invoice as a document - who it is from and to, which
 * invoice it is, what it bills and where it stands - for the page and for
 * the PDF the browser prints from it.
 *
 * The parties' addresses come from the snapshot frozen at issuance, not from
 * the accounts as they are today: a wallet changed since does not rewrite
 * who the invoice was addressed to. An invoice from before snapshots has
 * none, and falls back to the accounts. Currency is USD on every invoice -
 * legacy ones never recorded it, but none was ever issued in anything else.
 *
 * `paidOn` appears only once the invoice is paid, `milestone` only on a
 * fixed-price bill and `corrects` only on an adjustment; everything else is
 * always there, so a printed invoice never silently lacks a field.
 */
export const getInvoiceDocumentFields = (
  invoice: InvoiceDocumentSource | null,
  { t, formatDate }: { t: Translate; formatDate: (date: Date) => string },
): InvoiceDocumentField[] => {
  if (!invoice) {
    return []
  }

  const date = (value: string | null | undefined): string =>
    value ? formatDate(new Date(value)) : ''

  const fields: InvoiceDocumentField[] = [
    {
      id: 'from',
      label: t('invoice.document.from'),
      value: nameOf(invoice.user, t),
      detail: invoice.issuerAddress || invoice.user?.address || '',
    },
    {
      id: 'billTo',
      label: t('invoice.document.billTo'),
      value: nameOf(invoice.project?.user, t),
      detail: invoice.ownerAddress || invoice.project?.user?.address || '',
    },
    {
      id: 'reference',
      label: t('invoice.document.reference'),
      value: invoice.id ?? '',
    },
    {
      id: 'period',
      label: t('invoice.document.period'),
      value: t('invoice.document.periodRange', {
        from: date(invoice.fromAt),
        to: date(invoice.toAt),
      }),
    },
    {
      id: 'currency',
      label: t('invoice.document.currency'),
      value: invoice.currency || 'USD',
    },
    {
      id: 'amount',
      label: t('invoice.document.amount'),
      // The amount frozen at issuance, never recomputed from time.
      value: formatCents(Number(invoice.amountCents ?? 0)),
    },
    {
      id: 'status',
      label: t('invoice.document.status'),
      value: t(`invoice.state.${getInvoiceStatus(invoice)}`),
    },
  ]

  if (invoice.state === 'PAID' && invoice.paidAt) {
    fields.push({
      id: 'paidOn',
      label: t('invoice.document.paidOn'),
      value: date(invoice.paidAt),
    })
  }

  if (invoice.milestoneRef) {
    fields.push({
      id: 'milestone',
      label: t('invoice.document.milestone'),
      value: invoice.milestoneRef,
    })
  }

  if (invoice.correctsInvoiceId) {
    fields.push({
      id: 'corrects',
      label: t('invoice.document.corrects'),
      value: invoice.correctsInvoiceId,
    })
  }

  return fields
}
