const LONE_SURROGATE = /\p{Cs}/u

/**
 * RFC 8785 (JCS) for the values these documents hold: null, booleans,
 * strings, safe integers, arrays and plain objects. Keys sort by UTF-16 code
 * unit, which is what `Array.prototype.sort` does, and strings and integers
 * are written the way `JSON.stringify` writes them, which is what RFC 8785
 * specifies. Anything with more than one plausible text form is refused:
 * fractions, unsafe integers, lone surrogates, `undefined` and class
 * instances.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (typeof value === 'string') {
    if (LONE_SURROGATE.test(value)) {
      throw new TypeError('A string with a lone surrogate has no canonical form')
    }

    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Only safe integers are canonical here, got ${value}`)
    }

    return String(value)
  }

  if (Array.isArray(value)) {
    // Array.from turns a hole into undefined, which is refused below.
    return `[${Array.from(value, (item) => canonicalJson(item)).join(',')}]`
  }

  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>

    return `{${Object.keys(object)
      .sort()
      .map((key) => `${canonicalJson(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`
  }

  throw new TypeError(`A ${typeof value} has no canonical JSON form`)
}

/** True when the string contains no lone surrogate, so it has a UTF-8 form. */
export function isWellFormed(text: string): boolean {
  return !LONE_SURROGATE.test(text)
}
