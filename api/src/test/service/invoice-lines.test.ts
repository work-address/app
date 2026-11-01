import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { Time } from '@/entity/time'
import { InvoiceLines } from '@/service/invoice-lines'

const entry = (minutes: number, fields: Partial<Time> = {}): Time => {
  const fromAt = new Date('2026-10-01T08:00:00Z')

  return Object.assign(new Time(), {
    fromAt,
    toAt: new Date(fromAt.getTime() + minutes * 60000),
    source: 'desktop',
    ...fields,
  })
}

@suite()
export class InvoiceLinesTest {
  @test()
  roundsOnceAtTheEnd() {
    // Three cent-fractions per entry would round to 3 cents apart from the total
    const times = [entry(1), entry(1), entry(1)]

    expect(InvoiceLines.human(times, 10.1).amountCents).to.equal(51)
  }

  @test()
  aBackwardsEntryCountsAsNothing() {
    const line = InvoiceLines.human([entry(-10), entry(10)], 60)

    expect(line.minutes).to.equal(10)
    expect(line.amountCents).to.equal(1000)
  }

  @test()
  activeMinutesNeverExceedTheEntrysSpan() {
    const line = InvoiceLines.human([entry(10, { minutesActive: 25 })], 60)

    expect(line.activeMinutes).to.equal(10)
  }

  @test()
  manualMinutesAreThoseNotFromTheDesktop() {
    const line = InvoiceLines.human(
      [entry(10), entry(5, { source: 'manual' as Time['source'] })],
      60,
    )

    expect(line.minutes).to.equal(15)
    expect(line.manualMinutes).to.equal(5)
  }

  @test()
  noRateChargesNothing() {
    const line = InvoiceLines.human([entry(10)], 0)

    expect(line.rateHourCents).to.equal(0)
    expect(line.amountCents).to.equal(0)
  }

  @test()
  mixedIntervalsUseEachEntrysOwnSpan() {
    expect(InvoiceLines.human([entry(10), entry(1)], 60).minutes).to.equal(11)
  }
}
