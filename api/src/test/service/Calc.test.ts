import {suite, test} from '@testdeck/mocha';
import {expect} from 'chai';
import {Calc} from '../../service/Calc';

@suite()
export class CalcTest {
  @test()
  calc() {
    const a0 = Calc.rateTotal(0, 1000);
    const a1 = Calc.rateTotal(10, 1000);
    const a2 = Calc.rateTotal(20, 1000);
    const a3 = Calc.rateTotal(30, 1000);
    const a4 = Calc.rateTotal(40, 1000);
    const a5 = Calc.rateTotal(50, 1000);
    const a6 = Calc.rateTotal(60, 1000);

    const b0 = Calc.rateTotal(0, 30);
    const b1 = Calc.rateTotal(10, 30);
    const b2 = Calc.rateTotal(20, 30);
    const b3 = Calc.rateTotal(30, 30);
    const b4 = Calc.rateTotal(40, 30);
    const b5 = Calc.rateTotal(50, 30);
    const b6 = Calc.rateTotal(60, 30);

    expect(a0).to.be.eq(0);
    expect(a1).to.be.eq(166.66666666666666);
    expect(a2).to.be.eq(333.3333333333333);
    expect(a3).to.be.eq(500);
    expect(a4).to.be.eq(666.6666666666666);
    expect(a5).to.be.eq(833.3333333333334);
    expect(a6).to.be.eq(1000);

    expect(b0).to.be.eq(0);
    expect(b1).to.be.eq(5);
    expect(b2).to.be.eq(10);
    expect(b3).to.be.eq(15);
    expect(b4).to.be.eq(20);
    expect(b5).to.be.eq(25);
    expect(b6).to.be.eq(30);
  }
}
