import { describe, expect, it } from 'vitest'

import { premiumState } from './premium-state'

describe('premiumState', () => {
  it('shows nothing on a self-hosted instance, whatever the flag says', () => {
    expect(premiumState({ premium: true, billing: false })).toBe('unbilled')
    expect(premiumState({ premium: false, billing: false })).toBe('unbilled')
  })

  it('follows the entitlement-aware flag where billing applies', () => {
    expect(premiumState({ premium: true, billing: true })).toBe('premium')
    expect(premiumState({ premium: false, billing: true })).toBe('free')
  })

  it('treats a payload without the billing field as billed', () => {
    expect(premiumState({ premium: false })).toBe('free')
    expect(premiumState(null)).toBe('free')
  })
})
