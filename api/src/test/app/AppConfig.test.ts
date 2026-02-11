import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {AppConfig} from '../../app/AppConfig';

@suite()
export class AppConfigTest {
  @test()
  parameters() {
    const params = AppConfig.readConfig();

    expect(params).to.be.an.instanceOf(Object);
    expect(params).to.contain.keys(['host', 'port']);
  }
}
