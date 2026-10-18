import { IInvoiceLine } from '@/model/invoice'

export class InvoiceSnapshot {
  public static legacyHuman(
    amountCents: number,
    activeMinutes: number,
  ): IInvoiceLine {
    return {
      kind: 'human',
      name: 'Human time',
      basis: 'active',
      minutes: activeMinutes,
      activeMinutes,
      rateHourCents:
        activeMinutes > 0 ? (amountCents * 60) / activeMinutes : null,
      amountCents,
      rateChanges: [],
    }
  }
}
