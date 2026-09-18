import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { Calc } from '@/service/calc'

@suite()
export class CalcTest {
  @test()
  calc() {
    const a0 = Calc.rateTotal(0, 1000)
    const a1 = Calc.rateTotal(10, 1000)
    const a2 = Calc.rateTotal(20, 1000)
    const a3 = Calc.rateTotal(30, 1000)
    const a4 = Calc.rateTotal(40, 1000)
    const a5 = Calc.rateTotal(50, 1000)
    const a6 = Calc.rateTotal(60, 1000)

    const b0 = Calc.rateTotal(0, 30)
    const b1 = Calc.rateTotal(10, 30)
    const b2 = Calc.rateTotal(20, 30)
    const b3 = Calc.rateTotal(30, 30)
    const b4 = Calc.rateTotal(40, 30)
    const b5 = Calc.rateTotal(50, 30)
    const b6 = Calc.rateTotal(60, 30)

    expect(a0).to.be.eq(0)
    expect(a1).to.be.eq(166.66666666666666)
    expect(a2).to.be.eq(333.3333333333333)
    expect(a3).to.be.eq(500)
    expect(a4).to.be.eq(666.6666666666666)
    expect(a5).to.be.eq(833.3333333333334)
    expect(a6).to.be.eq(1000)

    expect(b0).to.be.eq(0)
    expect(b1).to.be.eq(5)
    expect(b2).to.be.eq(10)
    expect(b3).to.be.eq(15)
    expect(b4).to.be.eq(20)
    expect(b5).to.be.eq(25)
    expect(b6).to.be.eq(30)
  }

  /** The acceptance case for the invoice snapshot: 90 minutes at $20/h. */
  @test()
  amountCents_ninetyMinutesAtTwentyDollarsIsThreeThousandCents() {
    expect(Calc.amountCents(90, Calc.rateHourCents(20))).to.be.eq(3000)
    expect(Calc.amountCents(90, Calc.rateHourCents('20.00'))).to.be.eq(3000)
  }

  /**
   * Integer in, one rounding out, half up: anyone holding a snapshot's minutes
   * and rate recomputes its amount exactly. 7 minutes at $33.33 is 388.85
   * cents; 1 minute at $0.30 is exactly half a cent.
   */
  @test()
  amountCents_roundsOnceHalfUp() {
    expect(Calc.amountCents(7, 3333)).to.be.eq(389)
    expect(Calc.amountCents(1, 30)).to.be.eq(1)
    expect(Calc.amountCents(0, 3333)).to.be.eq(0)
  }

  /** The rate column is a two-decimal string; float noise never moves a cent. */
  @test()
  rateHourCents_readsTheDecimalColumnExactly() {
    expect(Calc.rateHourCents('20.10')).to.be.eq(2010)
    expect(Calc.rateHourCents(0.29)).to.be.eq(29)
    expect(Calc.rateHourCents('9999.99')).to.be.eq(999999)
    expect(Calc.rateHourCents(null)).to.be.eq(0)
  }
}
