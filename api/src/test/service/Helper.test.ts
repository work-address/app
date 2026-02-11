import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {Helper} from '../../service/Helper';

@suite()
export class HelperTest {
  @test()
  toFixedDecimals() {
    let numberDecimals = 2;
    let testNumber = 23.130000000000003;
    let result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(23.13);

    testNumber = -23.130000000000003;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(-23.13);

    testNumber = 23.00000000000000000000000009;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(23);

    testNumber = 23.00000000000000000000000001;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(23);

    testNumber = 23.00000000000000000000000001;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(23);

    testNumber = 0;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(0);

    numberDecimals = 5;
    testNumber = 23.123456789123456789;
    result = Helper.toFixedDecimals(testNumber, numberDecimals);

    expect(result).to.be.equal(23.12345);
  }
}
