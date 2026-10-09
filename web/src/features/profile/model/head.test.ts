import { describe, expect, it } from 'vitest'

import { buildProfileHead } from './head'

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key

describe('buildProfileHead', () => {
  it("titles someone else's profile with their name and indexes it", () => {
    expect(buildProfileHead({ name: 'Gudrun', isOwn: false }, t)).toEqual({
      title: 'Gudrun',
      description: 'profile.head.description {"name":"Gudrun"}',
      noindex: false,
    })
  })

  it('falls back to the short address when there is no name', () => {
    const head = buildProfileHead(
      { name: '  ', address: '0x19E…ff2A', isOwn: false },
      t,
    )

    expect(head.title).toBe('0x19E…ff2A')
  })

  it('keeps the personal title on your own profile and does not index it', () => {
    expect(buildProfileHead({ name: 'Gudrun', isOwn: true }, t)).toEqual({
      title: 'profile.title',
      description: 'profile.head.descriptionOwn',
      noindex: true,
    })
  })

  it('uses the generic title while nothing is known yet', () => {
    expect(buildProfileHead({ isOwn: false }, t).title).toBe(
      'profile.head.titleGeneric',
    )
  })

  it('does not publish a named profile preview when its request failed', () => {
    expect(
      buildProfileHead({ name: 'Gudrun', isOwn: false, failure: 'failed' }, t),
    ).toEqual({
      title: 'profile.loadFailure.title',
      description: 'profile.head.descriptionGeneric',
      noindex: true,
    })
  })

  it('says not found, unindexed, for an address with no account', () => {
    const head = buildProfileHead(
      { address: '0x99…9999', isOwn: false, failure: 'not-found' },
      t,
    )

    expect(head.title).toBe('profile.notFound.documentTitle')
    expect(head.noindex).toBe(true)
  })
})
