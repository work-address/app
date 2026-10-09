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
})
