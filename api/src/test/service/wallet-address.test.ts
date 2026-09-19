import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { EWalletChain } from '@/model/user'
import { WalletAddress } from '@/service/wallet-address'

const RAW = '0:4a5d1923244b0a845a7b5d8a29fd654b5a2a7a0331ce597e445b98dd23ab4025'
const FRIENDLY = 'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZJ'
const BOUNCEABLE = 'EQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJVuM'
const EVM = '0xAbC0000000000000000000000000000000000001'
/** Base58, and deliberately containing an uppercase letter. */
const SOLANA = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

@suite()
export class WalletAddressTest {
  /** Which account can anchor on IdentityRegistry is decided by this. */
  @test()
  chainOfNamesEachAccountsChain() {
    expect(WalletAddress.chainOf(EVM)).to.equal(EWalletChain.EVM)
    expect(WalletAddress.chainOf(EVM.toLowerCase())).to.equal(EWalletChain.EVM)
    expect(WalletAddress.chainOf(` ${EVM} `)).to.equal(EWalletChain.EVM)
    expect(WalletAddress.chainOf(RAW)).to.equal(EWalletChain.TON)
    expect(WalletAddress.chainOf(FRIENDLY)).to.equal(EWalletChain.TON)
    expect(WalletAddress.chainOf(BOUNCEABLE)).to.equal(EWalletChain.TON)
    expect(WalletAddress.chainOf(SOLANA)).to.equal(EWalletChain.SOLANA)
  }

  /** The bug this exists for: a friendly address must match the stored raw one. */
  @test()
  friendlyAndRawTonAreTheSameAccount() {
    expect(WalletAddress.toCanonical(FRIENDLY)).to.be.equal(RAW)
    expect(WalletAddress.isSame(FRIENDLY, RAW)).to.be.true
  }

  /** Both flag variants are the same account, so both must canonicalise alike. */
  @test()
  bounceableAndNonBounceableCollapseToOneAccount() {
    expect(WalletAddress.toCanonical(BOUNCEABLE)).to.be.equal(RAW)
    expect(WalletAddress.isSame(BOUNCEABLE, FRIENDLY)).to.be.true
  }

  /**
   * Non-bounceable, because these are addresses people send funds to and a
   * transfer to an uninitialised bounceable address is returned.
   */
  @test()
  friendlyFormIsNonBounceable() {
    expect(WalletAddress.toFriendly(RAW)).to.be.equal(FRIENDLY)
    expect(WalletAddress.toFriendly(RAW).startsWith('UQ')).to.be.true
  }

  @test()
  friendlyIsIdempotent() {
    expect(WalletAddress.toFriendly(FRIENDLY)).to.be.equal(FRIENDLY)
    expect(WalletAddress.toCanonical(RAW)).to.be.equal(RAW)
  }

  @test()
  evmComparesCaseInsensitivelyButStoresAsTyped() {
    expect(WalletAddress.toCanonical(EVM)).to.be.equal(EVM.toLowerCase())
    expect(WalletAddress.toFriendly(EVM)).to.be.equal(EVM)
    expect(WalletAddress.isSame(EVM, EVM.toLowerCase())).to.be.true
  }

  /**
   * EIP-55 checksum casing is a typo-detection mechanism, so the stored string
   * keeps it. Only the throwaway comparison form is lowercased.
   */
  @test()
  evmStorageKeepsChecksumCasing() {
    expect(WalletAddress.toStorage(EVM)).to.be.equal(EVM)
  }

  /** An address upper-cased whole reads `0X…`; casing must not decide access. */
  @test()
  evmPrefixIsMatchedCaseInsensitively() {
    expect(WalletAddress.isSame(EVM.toUpperCase(), EVM)).to.be.true
    expect(WalletAddress.toCanonical(EVM.toUpperCase())).to.be.equal(
      EVM.toLowerCase(),
    )
  }

  /** TON must collapse to raw for storage, since one account has two spellings. */
  @test()
  tonStorageCollapsesToRaw() {
    expect(WalletAddress.toStorage(FRIENDLY)).to.be.equal(RAW)
    expect(WalletAddress.toStorage(BOUNCEABLE)).to.be.equal(RAW)
  }

  /** base58 is case-sensitive - lowercasing a Solana address destroys it. */
  @test()
  solanaCaseIsPreserved() {
    expect(WalletAddress.toCanonical(SOLANA)).to.be.equal(SOLANA)
    expect(WalletAddress.toFriendly(SOLANA)).to.be.equal(SOLANA)
  }

  @test()
  whitespaceIsTrimmed() {
    expect(WalletAddress.toCanonical(`  ${FRIENDLY}  `)).to.be.equal(RAW)
  }

  /** A bad checksum is left as typed so validation reports it. */
  @test()
  malformedInputIsReturnedUnchanged() {
    const broken = 'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZZ'

    expect(WalletAddress.toCanonical(broken)).to.be.equal(broken)
  }
}
