import { AxiosError, type AxiosAdapter } from 'axios'
import i18n from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import './base'
import { client } from './generated/client.gen'

import type { FailureReport } from './failure-report'

import { runApi } from '@/shared/lib/api'

const { toast } = vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })

  return { toast: vi.fn() }
})

vi.mock('@/shared/lib/sonner', () => ({
  showToast: (type: string, options: { message: string }) =>
    toast(type, options.message),
}))

type Answer = { status: number; message?: string } | 'offline'

/** Stands in for the network: what the next request gets back. */
const answerWith = (answer: Answer) => {
  const adapter: AxiosAdapter = async (config) => {
    if (answer === 'offline') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }

    const response = {
      data: answer.message ? { message: answer.message } : {},
      status: answer.status,
      statusText: '',
      config,
      headers: {},
    }

    if (answer.status >= 400) {
      throw new AxiosError('', undefined, config, undefined, response as never)
    }

    return response
  }

  client.setConfig({ adapter })
}

/** What the person is shown once the request and the interceptor's timer are done. */
const shown = async (call: () => Promise<unknown>, report?: FailureReport) => {
  await runApi(call, report).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 5))

  return toast.mock.calls.map(([type, message]) => `${type}: ${message}`)
}

const request = () => client.get({ url: '/invoice' })

// In i18next's `cimode` a translation reads as its key.
const GENERIC = 'error: common.errors.unexpected'

describe('who reports a failed request', () => {
  beforeAll(() => i18n.init({ lng: 'cimode' }))
  beforeEach(() => toast.mockClear())

  it.each<[string, Answer, FailureReport | undefined, string[]]>([
    ['nothing declared', { status: 500 }, undefined, [GENERIC]],
    [
      'nothing declared, and the server says why',
      { status: 409, message: 'Already invoiced' },
      undefined,
      ['error: Already invoiced'],
    ],
    ['nothing declared, session refused', { status: 401 }, undefined, []],
    ['nothing declared, offline', 'offline', undefined, []],
    ['in place', { status: 500 }, 'in-place', []],
    ['in place, offline', 'offline', 'in-place', []],
    [
      'own message, and the server says why',
      { status: 409, message: 'Already invoiced' },
      { fallback: 'team.rate.saveError' },
      ['error: Already invoiced'],
    ],
    [
      'own message, offline',
      'offline',
      { fallback: 'team.rate.saveError' },
      ['error: Network Error'],
    ],
    [
      'fixed message, whatever the server says',
      { status: 409, message: 'Already invoiced' },
      { fixed: 'invoice.payment.failed' },
      ['error: invoice.payment.failed'],
    ],
    [
      'fixed message, offline',
      'offline',
      { fixed: 'invoice.payment.failed' },
      ['error: invoice.payment.failed'],
    ],
    [
      'fixed message, session refused',
      { status: 401 },
      { fixed: 'invoice.payment.failed' },
      ['error: invoice.payment.failed'],
    ],
  ])('%s', async (_, answer, report, expected) => {
    answerWith(answer)

    expect(await shown(request, report)).toEqual(expected)
  })

  it('says nothing when the request succeeds', async () => {
    answerWith({ status: 200 })

    expect(await shown(request, { fixed: 'invoice.payment.failed' })).toEqual(
      [],
    )
  })

  it('says nothing about a wallet the person closed', async () => {
    const closed = Object.assign(new Error('rejected'), { code: 4001 })

    expect(
      await shown(() => Promise.reject(closed), {
        fallback: 'team.rate.saveError',
      }),
    ).toEqual([])
  })

  it('reports an answer the call itself turns down', async () => {
    answerWith({ status: 200 })

    expect(
      await shown(
        async () => {
          await request()
          throw new Error('The server returned an invalid invoice settlement')
        },
        { fixed: 'invoice.payment.failed' },
      ),
    ).toEqual(['error: invoice.payment.failed'])
  })
})
