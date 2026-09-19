import { ProfileError } from './errors'
import { MAX_RATE_HOUR_CENTS, PROFILE_SCHEMA_V1, canonicalFieldValue } from './schema'

import type { FieldKey, ProfileFields } from './schema'

/**
 * The app's public `User` projection, as `GET /user/:address/address`
 * returns it. Only the schema v1 columns are read. Anything else, such as
 * `tz` or `address`, is ignored, so a wider projection can never leak into a
 * leaf.
 */
export type AppPublicUser = {
  name?: string | null
  title?: string | null
  company?: string | null
  bio?: string | null
  /** decimal(6,2) USDT an hour; Postgres returns it as text. */
  rate?: string | number | null
  /** Comma-separated, as the profile form stores it. */
  skills?: string | null
  city?: string | null
  country?: string | null
  facebook?: string | null
  linkedIn?: string | null
  twitter?: string | null
  instagram?: string | null
  youtube?: string | null
  telegram?: string | null
  [column: string]: unknown
}

export type SkippedField = { key: FieldKey; reason: string }

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/

/** The rate rule: whole cents from the decimal text, without floating point. Null for empty or zero. */
export function rateHourCentsFromDecimal(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'number' && !Number.isFinite(raw)) {
    throw new ProfileError('InvalidField', `rate must be a finite number, got ${raw}`)
  }

  const text = typeof raw === 'number' ? raw.toFixed(2) : raw.trim()

  if (text === '') return null

  const match = DECIMAL.exec(text)

  if (!match) {
    throw new ProfileError('InvalidField', `rate must be a decimal with at most two places, got ${text}`)
  }

  const cents = Number(match[1]) * 100 + Number(`${match[2] ?? ''}00`.slice(0, 2))

  if (cents === 0) return null

  if (!Number.isSafeInteger(cents) || cents > MAX_RATE_HOUR_CENTS) {
    throw new ProfileError('InvalidField', `rate must be at most ${MAX_RATE_HOUR_CENTS / 100} USDT an hour`)
  }

  return cents
}

/**
 * Schema v1 fields from the app's public profile. A column no rule can turn
 * into a value, such as a country that is not a two-letter code, is left out
 * and reported in `skipped`, so a caller can say which fields could not be
 * committed rather than failing the whole profile.
 */
export function profileFieldsFromAppUser(user: AppPublicUser): { fields: ProfileFields; skipped: SkippedField[] } {
  const fields: Record<string, unknown> = {}
  const skipped: SkippedField[] = []

  for (const definition of PROFILE_SCHEMA_V1) {
    const raw = user[definition.source]

    try {
      let input: unknown = raw

      if (definition.kind === 'rate') {
        const cents = rateHourCentsFromDecimal(raw as string | number | null | undefined)

        input = cents === null ? null : { currency: 'USDT', rateHourCents: cents }
      } else if (definition.kind === 'textList') {
        if (raw !== null && raw !== undefined && typeof raw !== 'string') {
          throw new ProfileError('InvalidField', `${definition.key} must be comma-separated text`)
        }

        input = raw === null || raw === undefined ? null : raw.split(',')
      }

      const value = canonicalFieldValue(definition, input)

      if (value !== null) fields[definition.key] = value
    } catch (error) {
      skipped.push({ key: definition.key, reason: error instanceof Error ? error.message : String(error) })
    }
  }

  return { fields: fields as ProfileFields, skipped }
}
