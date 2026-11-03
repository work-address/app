import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { AccountAddress } from '@/service/account-address'

const EVM = '0x52908400098527886E0F7030069857D2E4169EE7'
const EMAIL = 'someone@example.com'

@suite()
export class AccountAddressTest {
  @test()
  evmComparesCaseInsensitivelyButStoresAsTyped() {
    expect(AccountAddress.toCanonical(EVM)).to.be.equal(EVM.toLowerCase())
    expect(AccountAddress.toStorage(EVM)).to.be.equal(EVM)
    expect(AccountAddress.isSame(EVM, EVM.toLowerCase())).to.be.true
  }

  @test()
  evmPrefixIsMatchedCaseInsensitively() {
    expect(AccountAddress.isEvm(EVM.toUpperCase())).to.be.true
    expect(AccountAddress.isSame(EVM.toUpperCase(), EVM)).to.be.true
  }

  @test()
  emailIsStoredLowercase() {
    expect(AccountAddress.toStorage('SomeOne@Example.COM')).to.be.equal(EMAIL)
    expect(AccountAddress.isSame('SomeOne@Example.COM', EMAIL)).to.be.true
  }

  /** Google gives the address as registered, so nothing else is normalised. */
  @test()
  gmailDotsStayDifferentAddresses() {
    expect(AccountAddress.isSame('john.doe@gmail.com', 'johndoe@gmail.com')).to
      .be.false
  }

  @test()
  whitespaceIsTrimmed() {
    expect(AccountAddress.toStorage(`  ${EMAIL}  `)).to.be.equal(EMAIL)
    expect(AccountAddress.toCanonical(`  ${EVM}  `)).to.be.equal(
      EVM.toLowerCase(),
    )
  }

  @test()
  anythingElseIsNeither() {
    for (const value of [
      '',
      'not an address',
      'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZJ',
      '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      '0x1234',
    ]) {
      expect(AccountAddress.isEvm(value), value).to.be.false
      expect(AccountAddress.isEmail(value), value).to.be.false
    }
  }
}
