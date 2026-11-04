import type { InvoiceFilter } from './invoice-feed'

/** Dates as the picker gives them: local midnight of the chosen day. */
export type InvoicePeriodFilter = {
  fromAt: number | null
  toAt: number | null
}

/** Dollars, as typed: a half-typed "12." has to survive until the next key. */
export type InvoiceAmountFilter = {
  min: string
  max: string
}

export const EMPTY_INVOICE_PERIOD: InvoicePeriodFilter = {
  fromAt: null,
  toAt: null,
}

export const EMPTY_INVOICE_AMOUNT: InvoiceAmountFilter = { min: '', max: '' }

/** A price on its way to being typed: digits and at most two decimals. */
export const isInvoiceAmountInput = (value: string): boolean =>
  /^\d*[,.]?\d{0,2}$/.test(value)

/** Nothing usable yet ("", ".") filters on nothing rather than on zero. */
export const readInvoiceAmountCents = (value: string): number | undefined => {
  const normalized = value.replace(',', '.')

  if (!/\d/.test(normalized)) {
    return undefined
  }

  return Math.round(Number(normalized) * 100)
}

export const isSameInvoiceAmount = (
  a: InvoiceAmountFilter,
  b: InvoiceAmountFilter,
): boolean =>
  readInvoiceAmountCents(a.min) === readInvoiceAmountCents(b.min) &&
  readInvoiceAmountCents(a.max) === readInvoiceAmountCents(b.max)

/** The last moment of a day, so an invoice ending on the "to" date still counts. */
const endOfDay = (time: number): Date => {
  const date = new Date(time)
  date.setHours(23, 59, 59, 999)

  return date
}

/**
 * The search filter, with only the keys that are set: the API tests for a key's
 * presence, and "any filter on?" is whether anything is left here.
 */
export const buildInvoiceListFilter = ({
  projectId,
  state,
  period,
  amount,
}: {
  projectId: string
  state: InvoiceFilter['state'] | ''
  period: InvoicePeriodFilter
  amount: InvoiceAmountFilter
}): InvoiceFilter => {
  const amountFrom = readInvoiceAmountCents(amount.min)
  const amountTo = readInvoiceAmountCents(amount.max)

  return {
    ...(projectId ? { projectId } : {}),
    ...(state ? { state } : {}),
    ...(period.fromAt === null
      ? {}
      : { fromAt: new Date(period.fromAt).toISOString() }),
    ...(period.toAt === null
      ? {}
      : { toAt: endOfDay(period.toAt).toISOString() }),
    ...(amountFrom === undefined ? {} : { amountFrom }),
    ...(amountTo === undefined ? {} : { amountTo }),
  }
}
