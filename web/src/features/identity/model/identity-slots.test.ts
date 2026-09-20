import { describe, expect, it } from 'vitest'

import {
  identityDisclosure,
  identityPreview,
  isIdentityPublishable,
} from './identity-slots'

import type { AppPublicUser } from '@/shared/vendor/identity'

import {
  LEAF_COUNT,
  PROFILE_SCHEMA_V1,
  buildProfileTree,
  evmSubject,
} from '@/shared/vendor/identity'

const ADDRESS = '0x1111111111111111111111111111111111111111'

const user = (over: Partial<AppPublicUser> = {}): AppPublicUser => ({
  name: 'Grace Hopper',
  title: 'Rear Admiral',
  skills: 'COBOL,Compilers',
  rate: '200.00',
  ...over,
})

describe('identityPreview', () => {
  it('shows every schema v1 slot, in the order the tree holds them', () => {
    const { slots } = identityPreview(user())

    expect(slots.map(({ slot }) => slot)).toEqual(
      PROFILE_SCHEMA_V1.map(({ slot }) => slot),
    )
    expect(slots.map(({ key }) => key)).toEqual(
      PROFILE_SCHEMA_V1.map(({ key }) => key),
    )
    expect(slots.length).toBeLessThan(LEAF_COUNT)
  })

  it('commits only the columns that hold a value', () => {
    const preview = identityPreview(user())
    const committed = preview.slots.filter(({ state }) => state === 'committed')

    expect(committed.map(({ key }) => key)).toEqual([
      'name',
      'title',
      'rate',
      'skills',
    ])
    expect(preview.committedCount).toBe(4)
    expect(preview.emptyCount).toBe(PROFILE_SCHEMA_V1.length - 4)
    expect(preview.unusableCount).toBe(0)
  })

  it('reads the rate as whole cents, not as the profile text', () => {
    const { slots } = identityPreview(user({ rate: '12.34' }))
    const rate = slots.find(({ key }) => key === 'rate')

    expect(rate?.value).toEqual({ currency: 'USDT', rateHourCents: 1234 })
  })

  it('leaves a column schema v1 cannot take out, with its reason', () => {
    const preview = identityPreview(user({ country: 'Estonia' }))
    const country = preview.slots.find(({ key }) => key === 'country')

    expect(country?.state).toBe('unusable')
    expect(country?.reason).toMatch(/2 characters/)
    expect(preview.unusableCount).toBe(1)
    // The rest of the profile still publishes: one column nobody can commit
    // is not a reason to refuse the whole profile.
    expect(preview.committedCount).toBe(4)
  })

  it('never reads a column outside PRODUCT 4.7 into a leaf', () => {
    const preview = identityPreview(
      user({ email: 'grace@example.com', premium: true, roles: ['ADMIN'] }),
    )

    expect(Object.keys(preview.fields).sort()).toEqual([
      'name',
      'rate',
      'skills',
      'title',
    ])
  })

  it('treats a signed-out reader as an empty profile rather than throwing', () => {
    const preview = identityPreview(null)

    expect(preview.committedCount).toBe(0)
    expect(preview.slots).toHaveLength(PROFILE_SCHEMA_V1.length)
  })

  it('builds the very tree the preview describes', () => {
    const preview = identityPreview(user())
    const tree = buildProfileTree({
      subject: evmSubject(ADDRESS, 31_337),
      fields: preview.fields,
    })

    expect(tree.fields.map(({ key }) => key).sort()).toEqual(
      preview.slots
        .filter(({ state }) => state === 'committed')
        .map(({ key }) => key)
        .sort(),
    )
  })
})

describe('identityDisclosure', () => {
  it('discloses every committed field, because the profile page shows them all', () => {
    expect(identityDisclosure(identityPreview(user()))).toEqual([
      'name',
      'title',
      'rate',
      'skills',
    ])
  })

  it('discloses nothing a slot does not commit', () => {
    expect(
      identityDisclosure(identityPreview(user({ city: '   ' }))),
    ).not.toContain('city')
  })
})

describe('isIdentityPublishable', () => {
  it('refuses a profile whose every slot would be a filler', () => {
    expect(isIdentityPublishable(identityPreview({}))).toBe(false)
    expect(isIdentityPublishable(identityPreview(user()))).toBe(true)
  })
})
