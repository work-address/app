import { canonicalJson, isWellFormed } from './jcs'
import { ProfileError } from './errors'

/**
 * Profile schema v1 (contracts/docs/profile-schema-v1.md): which public
 * profile field sits in which leaf, and the one canonical form of its value.
 */

/** An hourly rate in hundredths of one USDT. */
export type RateValue = { currency: 'USDT'; rateHourCents: number }

export type FieldValue = string | string[] | RateValue

/** Schema v1 fields by name. Absent or empty fields are not committed; their slots hold fillers. */
export type ProfileFields = {
  name?: string | null
  title?: string | null
  company?: string | null
  bio?: string | null
  rate?: RateValue | null
  skills?: string[] | null
  city?: string | null
  country?: string | null
  facebook?: string | null
  linkedIn?: string | null
  twitter?: string | null
  instagram?: string | null
  youtube?: string | null
  telegram?: string | null
}

export type FieldKey = keyof ProfileFields

export type FieldKind = 'text' | 'country' | 'rate' | 'textList'

export type SlotDefinition = {
  readonly slot: number
  readonly key: FieldKey
  readonly pointer: string
  readonly kind: FieldKind
  /** Unicode code points after normalization; for a list, per item. */
  readonly maxLength: number
  /** Lists only. */
  readonly maxItems?: number
  /** The app `User` column the value is read from. */
  readonly source: string
}

const TEXT = 256

export const PROFILE_SCHEMA_V1: readonly SlotDefinition[] = Object.freeze([
  { slot: 0, key: 'name', pointer: '/name', kind: 'text', maxLength: TEXT, source: 'name' },
  { slot: 1, key: 'title', pointer: '/title', kind: 'text', maxLength: TEXT, source: 'title' },
  { slot: 2, key: 'company', pointer: '/company', kind: 'text', maxLength: TEXT, source: 'company' },
  { slot: 3, key: 'bio', pointer: '/bio', kind: 'text', maxLength: 16384, source: 'bio' },
  { slot: 4, key: 'rate', pointer: '/rate', kind: 'rate', maxLength: 0, source: 'rate' },
  { slot: 5, key: 'skills', pointer: '/skills', kind: 'textList', maxLength: 128, maxItems: 64, source: 'skills' },
  { slot: 6, key: 'city', pointer: '/location/city', kind: 'text', maxLength: TEXT, source: 'city' },
  { slot: 7, key: 'country', pointer: '/location/country', kind: 'country', maxLength: 2, source: 'country' },
  { slot: 8, key: 'facebook', pointer: '/social/facebook', kind: 'text', maxLength: TEXT, source: 'facebook' },
  { slot: 9, key: 'linkedIn', pointer: '/social/linkedIn', kind: 'text', maxLength: TEXT, source: 'linkedIn' },
  { slot: 10, key: 'twitter', pointer: '/social/twitter', kind: 'text', maxLength: TEXT, source: 'twitter' },
  { slot: 11, key: 'instagram', pointer: '/social/instagram', kind: 'text', maxLength: TEXT, source: 'instagram' },
  { slot: 12, key: 'youtube', pointer: '/social/youtube', kind: 'text', maxLength: TEXT, source: 'youtube' },
  { slot: 13, key: 'telegram', pointer: '/social/telegram', kind: 'text', maxLength: TEXT, source: 'telegram' },
] as SlotDefinition[])

/** Slots from here to 31 are reserved in v1 and always hold fillers. */
export const FIRST_RESERVED_SLOT = PROFILE_SCHEMA_V1.length

/** decimal(6,2): up to 9999.99 USDT an hour. */
export const MAX_RATE_HOUR_CENTS = 999999

const COUNTRY = /^[A-Z]{2}$/

export function slotDefinition(slot: number): SlotDefinition | undefined {
  return PROFILE_SCHEMA_V1[slot]
}

export function fieldDefinition(key: string): SlotDefinition | undefined {
  return PROFILE_SCHEMA_V1.find((definition) => definition.key === key)
}

function codePoints(text: string): number {
  return Array.from(text).length
}

/**
 * The text rule: trim as `String.prototype.trim` does, then NFC. Null when
 * nothing is left; an error when the result is over the slot's limit.
 */
export function canonicalText(raw: string, maxLength: number, label: string): string | null {
  if (!isWellFormed(raw)) {
    throw new ProfileError('InvalidField', `${label} contains a lone surrogate`)
  }

  const text = raw.trim().normalize('NFC')

  if (text === '') return null

  if (codePoints(text) > maxLength) {
    throw new ProfileError('InvalidField', `${label} is longer than ${maxLength} characters`)
  }

  return text
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
}

/**
 * The canonical value of one field, or null when the field is absent.
 * Accepts loose input (untrimmed, not NFC, empty list items) and throws a
 * `ProfileError` for input no rule can turn into a value.
 */
export function canonicalFieldValue(definition: SlotDefinition, input: unknown): FieldValue | null {
  const label = definition.key

  if (input === null || input === undefined) return null

  switch (definition.kind) {
    case 'text': {
      if (typeof input !== 'string') throw new ProfileError('InvalidField', `${label} must be text`)

      return canonicalText(input, definition.maxLength, label)
    }

    case 'country': {
      if (typeof input !== 'string') throw new ProfileError('InvalidField', `${label} must be text`)

      const code = canonicalText(input, definition.maxLength, label)

      if (code !== null && !COUNTRY.test(code)) {
        throw new ProfileError('InvalidField', `${label} must be an ISO 3166-1 alpha-2 code, got ${code}`)
      }

      return code
    }

    case 'rate': {
      if (
        !isPlainObject(input) ||
        Object.keys(input).sort().join(',') !== 'currency,rateHourCents' ||
        input.currency !== 'USDT' ||
        !Number.isSafeInteger(input.rateHourCents)
      ) {
        throw new ProfileError('InvalidField', `${label} must be { currency: 'USDT', rateHourCents: <integer> }`)
      }

      const cents = input.rateHourCents as number

      // Zero is the app column's default and means "never set".
      if (cents === 0) return null

      if (cents < 0 || cents > MAX_RATE_HOUR_CENTS) {
        throw new ProfileError('InvalidField', `${label} must be 1 to ${MAX_RATE_HOUR_CENTS} cents an hour`)
      }

      return { currency: 'USDT', rateHourCents: cents }
    }

    case 'textList': {
      if (!Array.isArray(input)) throw new ProfileError('InvalidField', `${label} must be a list of text`)

      const items: string[] = []

      for (const item of Array.from(input as unknown[])) {
        if (typeof item !== 'string') throw new ProfileError('InvalidField', `${label} must be a list of text`)

        const text = canonicalText(item, definition.maxLength, `${label} item`)

        if (text !== null) items.push(text)
      }

      if (items.length > (definition.maxItems ?? 0)) {
        throw new ProfileError('InvalidField', `${label} has more than ${definition.maxItems} items`)
      }

      return items.length === 0 ? null : items
    }
  }
}

/**
 * True when `value` is already a field's canonical value. A verifier uses
 * this and refuses anything else rather than normalizing it, so each field
 * has exactly one accepted byte string.
 */
export function isCanonicalFieldValue(definition: SlotDefinition, value: unknown): value is FieldValue {
  try {
    const canonical = canonicalFieldValue(definition, value)

    return canonical !== null && canonicalJson(canonical) === canonicalJson(value)
  } catch {
    return false
  }
}
