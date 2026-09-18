/**
 * RFC 8785 JSON Canonicalization Scheme (JCS), for the values a financial
 * record holds: strings, safe integers, booleans, null, arrays and plain
 * objects.
 *
 * One document has exactly one serialisation: object keys sorted by UTF-16
 * code unit (what `Array.prototype.sort` does by default), no whitespace, and
 * strings and numbers written the way ECMAScript's `JSON.stringify` writes
 * them, which is what RFC 8785 specifies. The same bytes therefore come out
 * of any conforming implementation - the contracts repository's tests and an
 * independent verifier included - however the object was assembled.
 *
 * Anything with more than one plausible text form is refused rather than
 * guessed at: fractions and unsafe integers (money is integer cents), strings
 * that are not well-formed Unicode, and `undefined`, functions, dates or class
 * instances (a timestamp is an ISO-8601 string by the time it gets here).
 */
export class CanonicalJson {
  public static stringify(value: unknown): string {
    if (value === null || typeof value === 'boolean') {
      return JSON.stringify(value)
    }

    if (typeof value === 'string') {
      return CanonicalJson.string(value)
    }

    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) {
        throw new TypeError(
          `Only safe integers are canonical here, got ${String(value)}`,
        )
      }

      return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => CanonicalJson.stringify(item)).join(',')}]`
    }

    if (CanonicalJson.isPlainObject(value)) {
      const body = Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${CanonicalJson.string(key)}:${CanonicalJson.stringify(value[key])}`,
        )
        .join(',')

      return `{${body}}`
    }

    throw new TypeError(`A ${typeof value} has no canonical JSON form`)
  }

  /**
   * A string as RFC 8785 writes it - which is how `JSON.stringify` writes it,
   * except that JCS text must be well-formed Unicode: a lone surrogate has no
   * UTF-8 encoding, so two implementations would hash it differently.
   */
  private static string(value: string): string {
    if (/\p{Cs}/u.test(value)) {
      throw new TypeError(
        'A string with a lone surrogate has no canonical form',
      )
    }

    return JSON.stringify(value)
  }

  private static isPlainObject(
    value: unknown,
  ): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
  }
}
