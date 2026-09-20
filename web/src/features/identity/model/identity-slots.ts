import type {
  AppPublicUser,
  FieldKey,
  FieldValue,
  ProfileFields,
} from '@/shared/vendor/identity'

import {
  PROFILE_SCHEMA_V1,
  profileFieldsFromAppUser,
} from '@/shared/vendor/identity'

/**
 * What one leaf of the profile tree will hold, for the preview the holder
 * reads before they publish.
 *
 * - `committed`: the field has a value, so its leaf commits to that value.
 * - `empty`: the field is unset, so its slot holds a filler - a random leaf
 *   that opens to nothing. An empty field is not "published as blank": the
 *   commitment cannot even be asked about it.
 * - `unusable`: the column holds something schema v1 has no canonical form
 *   for (a country that is not a two-letter code, say). It is left out with
 *   its reason rather than failing the whole publish.
 */
export type IdentitySlotState = 'committed' | 'empty' | 'unusable'

export type IdentitySlotPreview = {
  slot: number
  key: FieldKey
  /** The JSON pointer the leaf binds the value to. */
  pointer: string
  state: IdentitySlotState
  /** The canonical value, for the preview to render. Null unless committed. */
  value: FieldValue | null
  /** Why schema v1 could not take the column. Null unless unusable. */
  reason: string | null
}

export type IdentityPreview = {
  slots: IdentitySlotPreview[]
  /** The schema v1 fields the tree is built from. */
  fields: ProfileFields
  /** Slots that will commit to a value. */
  committedCount: number
  /** Slots that will hold a filler. */
  emptyCount: number
  /** Columns schema v1 has no canonical form for. */
  unusableCount: number
}

/**
 * Every schema v1 slot in its own order, with what the holder's profile puts
 * in it. Only PRODUCT 4.7 profile columns are read - the library's own
 * projection decides that, so a wider user record can never reach a leaf.
 */
export const identityPreview = (
  user: AppPublicUser | null | undefined,
): IdentityPreview => {
  const { fields, skipped } = user
    ? profileFieldsFromAppUser(user)
    : { fields: {} as ProfileFields, skipped: [] }
  const reasons = new Map(skipped.map(({ key, reason }) => [key, reason]))

  const slots = PROFILE_SCHEMA_V1.map(
    ({ slot, key, pointer }): IdentitySlotPreview => {
      const reason = reasons.get(key)

      if (reason !== undefined) {
        return { slot, key, pointer, state: 'unusable', value: null, reason }
      }

      const value = fields[key] ?? null

      return value === null
        ? { slot, key, pointer, state: 'empty', value: null, reason: null }
        : { slot, key, pointer, state: 'committed', value, reason: null }
    },
  )

  const count = (state: IdentitySlotState) =>
    slots.filter((entry) => entry.state === state).length

  return {
    slots,
    fields,
    committedCount: count('committed'),
    emptyCount: count('empty'),
    unusableCount: count('unusable'),
  }
}

/**
 * The fields a presentation discloses. Every committed field: the profile
 * page already shows all of them to anyone, so withholding one here would
 * hide nothing while making the anchored copy disagree with the page it
 * anchors. The undisclosed slots still hold their salted leaves, which is
 * what the private export is for.
 */
export const identityDisclosure = (preview: IdentityPreview): FieldKey[] =>
  preview.slots
    .filter(({ state }) => state === 'committed')
    .map(({ key }) => key)

/** Nothing to commit means nothing to publish; the tree would be all fillers. */
export const isIdentityPublishable = (preview: IdentityPreview): boolean =>
  preview.committedCount > 0
