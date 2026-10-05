import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { getLoadFailureKind, isRecordId } from './load-failure'

const httpError = (status: number) =>
  new AxiosError('request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

describe('getLoadFailureKind', () => {
  it('reads a 404 as a record that is not there', () => {
    expect(getLoadFailureKind(httpError(404))).toBe('not-found')
  })

  it('reads the API body of a missing record as not found', () => {
    expect(
      getLoadFailureKind({
        name: 'NotFoundError',
        message: 'Invoice does not exist',
      }),
    ).toBe('not-found')
  })

  it('reads any other API body as a failure', () => {
    expect(
      getLoadFailureKind({ name: 'QueryFailedError', message: 'boom' }),
    ).toBe('failed')
  })

  it('reads any other status as a failure worth retrying', () => {
    expect(getLoadFailureKind(httpError(500))).toBe('failed')
    expect(getLoadFailureKind(httpError(403))).toBe('failed')
  })

  it('reads a dropped connection or a thrown value as a failure', () => {
    expect(getLoadFailureKind(new AxiosError('Network Error'))).toBe('failed')
    expect(getLoadFailureKind(new Error('boom'))).toBe('failed')
    expect(getLoadFailureKind(null)).toBe('failed')
  })
})

describe('isRecordId', () => {
  it('accepts a UUID in either case', () => {
    expect(isRecordId('b52e606f-17bc-4c1e-836f-9f74dcbab006')).toBe(true)
    expect(isRecordId('B52E606F-17BC-4C1E-836F-9F74DCBAB006')).toBe(true)
  })

  it('rejects anything that cannot name a record', () => {
    expect(isRecordId()).toBe(false)
    expect(isRecordId('')).toBe(false)
    expect(isRecordId('not-a-uuid')).toBe(false)
    expect(isRecordId('b52e606f-17bc-4c1e-836f-9f74dcbab006x')).toBe(false)
  })
})
