import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { CanonicalJson } from '@/service/canonical-json'

/**
 * RFC 8785 for the values a financial record holds. The property that matters
 * is that one document has one text, however it was assembled.
 */
@suite()
export class CanonicalJsonTest {
  @test()
  stringify_sortsKeysAtEveryDepthWhateverTheInsertionOrder() {
    const built = { b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } }
    const reordered = { a: { c: 'x', d: [3, { y: null, z: true }] }, b: 1 }

    expect(CanonicalJson.stringify(built)).to.equal(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
    )
    expect(CanonicalJson.stringify(reordered)).to.equal(
      CanonicalJson.stringify(built),
    )
  }

  /** Arrays are ordered data; only object keys are sorted. */
  @test()
  stringify_keepsArrayOrder() {
    expect(CanonicalJson.stringify([2, 1, 'b', 'a'])).to.equal('[2,1,"b","a"]')
  }

  /**
   * Keys sort by UTF-16 code unit, as RFC 8785 section 3.2.3 says - so an
   * upper-case key sorts before a lower-case one, and "10" before "9".
   */
  @test()
  stringify_sortsKeysByCodeUnit() {
    expect(CanonicalJson.stringify({ b: 0, B: 0, 9: 0, 10: 0 })).to.equal(
      '{"10":0,"9":0,"B":0,"b":0}',
    )
  }

  @test()
  stringify_escapesStringsAsEcmaScriptDoes() {
    expect(CanonicalJson.stringify({ s: 'a"b\\c\n\u0001é€' })).to.equal(
      String.raw`{"s":"a\"b\\c\n\u0001é€"}`,
    )
  }

  /** A lone surrogate has no UTF-8 form, so no two hashes of it would agree. */
  @test()
  stringify_refusesStringsThatAreNotWellFormedUnicode() {
    expect(() => CanonicalJson.stringify({ s: 'a\uD800b' })).to.throw(TypeError)
    expect(() => CanonicalJson.stringify({ ['\uDC00']: 1 })).to.throw(TypeError)
    expect(CanonicalJson.stringify({ s: '\u{1F600}' })).to.equal(
      '{"s":"\u{1F600}"}',
    )
  }

  /**
   * Money is integer cents and time integer minutes: a fraction or an integer
   * past 2^53 has no single text form across platforms, so it is refused.
   */
  @test()
  stringify_refusesNumbersWithoutOneTextForm() {
    for (const value of [
      0.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => CanonicalJson.stringify({ value })).to.throw(TypeError)
    }
  }

  /** A date, `undefined` or a class instance is refused rather than guessed. */
  @test()
  stringify_refusesValuesJsonWouldCoerce() {
    class Box {
      public value = 1
    }

    for (const value of [new Date(0), undefined, new Box(), () => 1]) {
      expect(() => CanonicalJson.stringify({ value })).to.throw(TypeError)
    }
  }
}
