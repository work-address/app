import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { toGoogleSignInError } from './google.model'

const failure = (status: number, name?: string) =>
  new AxiosError('failed', undefined, undefined, undefined, {
    status,
    data: { name },
  } as AxiosResponse)

describe('toGoogleSignInError', () => {
  it('names the refusals the person can act on', () => {
    expect(toGoogleSignInError(failure(401, 'GoogleEmailTakenException'))).toBe(
      'emailTaken',
    )
    expect(
      toGoogleSignInError(failure(401, 'GoogleEmailUnverifiedException')),
    ).toBe('emailUnverified')
  })

  it('treats any other refusal as a failed attempt', () => {
    expect(toGoogleSignInError(failure(401, 'AuthenticationException'))).toBe(
      'failed',
    )
    expect(toGoogleSignInError(new Error('not from the API'))).toBe('failed')
  })

  it('tells a service that is down from a refusal', () => {
    expect(
      toGoogleSignInError(failure(503, 'GoogleUnavailableException')),
    ).toBe('unavailable')
    expect(toGoogleSignInError(failure(500))).toBe('unavailable')
    expect(toGoogleSignInError(new AxiosError('Network Error'))).toBe(
      'unavailable',
    )
  })
})
