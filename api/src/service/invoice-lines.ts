import { Time } from '@/entity/time'
import { IInvoiceLine } from '@/model/invoice'
import { Calc } from '@/service/calc'

/**
 * What an invoice charges for the issuer's own entries. Pure, beside
 * AgentInvoiceLines, so the money can be checked without a database.
 */
export class InvoiceLines {
  public static human(times: Time[], rateHour: number): IInvoiceLine {
    const minutes = Calc.spanMinutes(times)
    const rateHourCents = Math.round(rateHour * 100)
    const from = (...sources: Time['source'][]) =>
      times.filter((time) => sources.includes(time.source))
    const mobileMinutes = Calc.spanMinutes(from('mobile'))

    return {
      kind: 'human',
      name: 'Human time',
      basis: 'tracked',
      minutes,
      // Minutes with input, so the desktop's alone: a phone captures none.
      activeMinutes: from('desktop').reduce(
        (sum, time) =>
          sum + Math.min(Calc.spanMinutes([time]), time.minutesActive || 0),
        0,
      ),
      manualMinutes: Calc.spanMinutes(from('manual', 'web')),
      // Tracked time, billed as the desktop's is, and never manual.
      ...(mobileMinutes ? { mobileMinutes } : {}),
      rateHourCents,
      // Rounded once, at the end: rounding per entry accumulates a cent of
      // drift for every row on a long invoice.
      amountCents: Math.round((minutes * rateHourCents) / 60),
      rateChanges: [],
    }
  }
}
