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
  manualMinutesAreThoseAddedByHandOrTheWebTimer() {
    const line = InvoiceLines.human(
      [entry(10), entry(5, { source: 'manual' }), entry(3, { source: 'web' })],
      60,
    )

    expect(line.minutes).to.equal(18)
    expect(line.manualMinutes).to.equal(8)
    expect(line).not.to.have.property('mobileMinutes')
  }

  @test()
  phoneTimeIsBilledAsTrackedTimeInAPartOfItsOwn() {
    const line = InvoiceLines.human(
      [
        entry(10, { minutesActive: 4 }),
        entry(10, { source: 'mobile', minutesActive: 10 }),
        entry(5, { source: 'manual' }),
      ],
      60,
    )

    expect(line.minutes).to.equal(25)
    expect(line.amountCents).to.equal(2500)
    expect(line.mobileMinutes).to.equal(10)
    expect(line.manualMinutes).to.equal(5)
    // Active minutes are minutes with input: the phone's never are.
    expect(line.activeMinutes).to.equal(4)
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
