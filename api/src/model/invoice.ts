export enum EInvoiceState {
  PAID = 'PAID',
  REQUESTED = 'Requested',
  REJECTED = 'REJECTED',
}

/** The billed snapshot and its activity references. Rates and amounts never use today's project rate. */
export interface IInvoiceReport {
  rateHour: number | null
  rateTotal: number
  minutes: number
  minutesActive: number
  minutesPaid: number
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

export interface IInvoiceLine {
  kind: 'human' | 'agent'
  agentId?: string
  name: string
  basis: 'tracked' | 'active'
  minutes: number
  activeMinutes?: number
  manualMinutes?: number
  assistedMinutes?: number
  waitMinutes?: number
  unclassifiedMinutes?: number
  rateHourCents: number | null
  amountCents: number
  rateChanges: {
    at: string
    fromCents: number
    toCents: number
    minutesBefore: number
  }[]
}
