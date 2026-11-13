import { describe, expect, it } from 'vitest'

import { buildTimeTrackerConnectView } from './view'

describe('pairing page states', () => {
  const defaults = {
    nonce: 'audit-link',
    authenticated: false,
    authPending: false,
    errorName: null,
  }

  it('withholds wallet options until the nonce check succeeds', () => {
    const loading = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'loading',
    })
    expect(loading.showWalletProviders).toBe(false)
    expect(loading.checkingLink).toBe(true)

    const ready = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'awaiting_auth',
    })
    expect(ready.showWalletProviders).toBe(true)
  })

  it('narrates owner pairing without asking them to sign in again', () => {
    const view = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'connecting',
      authenticated: true,
    })
    expect(view.descriptionKey).toBe('connect.description.pairing')
    expect(view.showLoading).toBe(true)
    expect(view.showWalletProviders).toBe(false)
  })

  it('distinguishes wallet authorization from nonce checking', () => {
    const view = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'awaiting_auth',
      authPending: true,
    })
    expect(view.headingKey).toBe('connect.heading.signingIn')
    expect(view.checkingLink).toBe(false)
    expect(view.showWalletProviders).toBe(false)
  })

  it('offers retry only for recoverable request failures', () => {
    const transient = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'error',
    })
    const expired = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'error',
      errorName: 'TimeTrackerException',
    })
    expect(transient.canRetry).toBe(true)
    expect(expired.canRetry).toBe(false)
    expect(expired.descriptionKey).toBe('connect.description.expired')
  })

  it('leads on from the screens nothing on the page can fix', () => {
    const incomplete = buildTimeTrackerConnectView({
      ...defaults,
      nonce: null,
      phase: 'idle',
    })
    const expired = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'error',
      errorName: 'TimeTrackerException',
    })
    const transient = buildTimeTrackerConnectView({
      ...defaults,
      phase: 'error',
    })

    expect(incomplete.showWayOn).toBe(true)
    expect(expired.showWayOn).toBe(true)
    // A retryable failure offers its retry instead.
    expect(transient.showWayOn).toBe(false)
  })

  describe('opened by the phone app', () => {
    const connected = {
      ...defaults,
      phase: 'connected',
      authenticated: true,
    } as const

    it('sends a connected phone back to the app', () => {
      const view = buildTimeTrackerConnectView({
        ...connected,
        fromPhone: true,
      })

      expect(view.headingKey).toBe('connect.phone.heading.connected')
      expect(view.descriptionKey).toBe('connect.phone.description.connected')
      expect(view.showReturnToApp).toBe(true)
    })

    it('reads as the tracker until it is connected', () => {
      for (const phase of ['loading', 'awaiting_auth', 'connecting'] as const) {
        const phone = buildTimeTrackerConnectView({
          ...defaults,
          phase,
          fromPhone: true,
        })
        const tracker = buildTimeTrackerConnectView({ ...defaults, phase })

        expect(phone).toEqual(tracker)
      }
    })

    it('offers the way back to the phone only', () => {
      expect(buildTimeTrackerConnectView(connected).showReturnToApp).toBe(false)
      expect(
        buildTimeTrackerConnectView({ ...connected, fromWebsite: true })
          .showReturnToApp,
      ).toBe(false)
    })
  })

  describe('opened by the website', () => {
    const phases = [
      { nonce: null, phase: 'idle' },
      { phase: 'loading' },
      { phase: 'awaiting_auth' },
      { phase: 'awaiting_auth', authPending: true },
      { phase: 'connecting', authenticated: true },
      { phase: 'connected', authenticated: true },
      { phase: 'error', errorName: 'TimeTrackerException' },
      { phase: 'error' },
    ] as const

    it.each(phases)('never mentions the time tracker: %o', (state) => {
      const view = buildTimeTrackerConnectView({
        ...defaults,
        ...state,
        fromWebsite: true,
      })

      for (const key of [view.headingKey, view.descriptionKey]) {
        expect(WEBSITE_SAFE_KEYS).toContain(key)
      }
    })

    it.each(phases)('leaves the tracker wording alone: %o', (state) => {
      const tracker = buildTimeTrackerConnectView({ ...defaults, ...state })

      expect(tracker.headingKey).not.toContain('connect.website.')
      expect(tracker.descriptionKey).not.toContain('connect.website.')
    })

    it('says the sign-in is done, not that a tracker connected', () => {
      const view = buildTimeTrackerConnectView({
        ...defaults,
        phase: 'connected',
        authenticated: true,
        fromWebsite: true,
      })

      expect(view.headingKey).toBe('connect.website.heading.connected')
      expect(view.showConnected).toBe(true)
    })

    it('keeps the same actions as the tracker', () => {
      const expired = buildTimeTrackerConnectView({
        ...defaults,
        phase: 'error',
        errorName: 'TimeTrackerException',
        fromWebsite: true,
      })

      expect(expired.showWayOn).toBe(true)
      expect(expired.canRetry).toBe(false)
    })
  })
})

/**
 * Keys that read correctly to someone signing in to the website. The two
 * outside `connect.website.` are worded without mentioning a tracker.
 */
const WEBSITE_SAFE_KEYS = [
  'connect.website.title',
  'connect.website.heading.incomplete',
  'connect.website.heading.loading',
  'connect.website.heading.connected',
  'connect.website.heading.expired',
  'connect.website.heading.failed',
  'connect.website.description.default',
  'connect.website.description.loading',
  'connect.website.description.signingIn',
  'connect.website.description.connected',
  'connect.website.description.retry',
  'connect.heading.signingIn',
  'connect.description.failed',
]
