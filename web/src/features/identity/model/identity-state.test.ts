import { describe, expect, it } from 'vitest'

import {
  IDENTITY_ACTION_MESSAGE_KEY,
  IDENTITY_ACTION_TONE,
  IDENTITY_VIEW_MESSAGE_KEY,
  identityActionState,
  identityApiOutcome,
  identityViewState,
  isIdentityChipState,
  type IdentityActionOutcome,
  type IdentityActionState,
  type IdentityChainResult,
  type IdentityStatus,
  type IdentityUnavailable,
  type IdentityView,
  type IdentityWalletFailure,
} from './identity-state'

/**
 * The enumerations the API documents, listed once. Each list is pinned to the
 * union the generated client carries in both directions, so a value added or
 * renamed on the API side fails the build here rather than falling through
 * this feature's mapping at runtime.
 */
const CHAIN_RESULTS = [
  'Unpublished',
  'VersionUnknown',
  'CommitmentMismatch',
  'SchemaMismatch',
  'Superseded',
  'Deactivated',
  'Current',
] as const satisfies readonly IdentityChainResult[]

const UNAVAILABLE = [
  'NotConfigured',
  'RpcUnavailable',
  'WrongChain',
] as const satisfies readonly IdentityUnavailable[]

/** Every refusal `IdentityPresentationException` can carry (api/src/model/identity.ts). */
const REFUSALS = [
  'UnsupportedSubjectScheme',
  'MalformedPresentation',
  'UnsupportedFormat',
  'UnsupportedSchema',
  'InvalidProof',
  'CommitmentMismatch',
  'SignatureInvalid',
  'NotAnchored',
  'WrongRegistry',
  'ExportRequired',
  'ExportNotExpected',
  'InvalidExport',
  'ExportMismatch',
] as const

const WALLET_FAILURES = [
  'declined',
  'locked',
  'noEndpoint',
  'wrongChain',
  'failed',
] as const satisfies readonly IdentityWalletFailure[]

type NeverLeft<T, Listed> = Exclude<T, Listed> extends never ? true : never

const chainResultsExhaustive: NeverLeft<
  IdentityChainResult,
  (typeof CHAIN_RESULTS)[number]
> = true
const unavailableExhaustive: NeverLeft<
  IdentityUnavailable,
  (typeof UNAVAILABLE)[number]
> = true
const walletExhaustive: NeverLeft<
  IdentityWalletFailure,
  (typeof WALLET_FAILURES)[number]
> = true

const api = (
  status: number,
  errors?: Record<string, unknown>[],
): IdentityActionOutcome =>
  identityApiOutcome({ response: { status, data: { errors } } })

const status = (over: Partial<IdentityStatus> = {}): IdentityStatus => ({
  result: 'Current',
  subjectDeactivated: false,
  checkedAtBlock: 42,
  finalized: true,
  unavailable: null,
  ...over,
})

const view = (over: Partial<IdentityStatus> = {}): IdentityView =>
  ({
    address: '0x1111111111111111111111111111111111111111',
    subject: 'did:pkh:eip155:31337:0x1111111111111111111111111111111111111111',
    version: 1,
    presentation: {},
    status: status(over),
    history: null,
  }) as IdentityView

describe('the lists this feature maps', () => {
  it('covers every value the generated client can hold', () => {
    expect(chainResultsExhaustive).toBe(true)
    expect(unavailableExhaustive).toBe(true)
    expect(walletExhaustive).toBe(true)
  })
})

describe('identityActionState', () => {
  const outcomes: [string, IdentityActionOutcome, IdentityActionState][] = [
    ['a publish the API accepted', { kind: 'published' }, 'published'],
    ['a deactivate the chain mined', { kind: 'withdrawn' }, 'withdrawn'],
    ['the hosted copy taken down', { kind: 'removed' }, 'removed'],
    ...WALLET_FAILURES.map(
      (code): [string, IdentityActionOutcome, IdentityActionState] => [
        `the wallet failing with ${code}`,
        { kind: 'wallet', code },
        code === 'declined'
          ? 'declined'
          : code === 'locked'
            ? 'locked'
            : code === 'noEndpoint'
              ? 'noEndpoint'
              : code === 'wrongChain'
                ? 'wrongChain'
                : 'failed',
      ],
    ),
    ['another subject (403)', api(403), 'notSubject'],
    ...CHAIN_RESULTS.filter((result) => result !== 'Current').map(
      (result): [string, IdentityActionOutcome, IdentityActionState] => [
        `the registry answering ${result} (409)`,
        api(409, [{ result, subjectDeactivated: false }]),
        'stale',
      ],
    ),
    ...REFUSALS.map(
      (reason): [string, IdentityActionOutcome, IdentityActionState] => [
        `the document refused as ${reason} (422)`,
        api(422, [{ reason }]),
        reason === 'UnsupportedSubjectScheme' ? 'notAnchorable' : 'refused',
      ],
    ),
    ...UNAVAILABLE.map(
      (reason): [string, IdentityActionOutcome, IdentityActionState] => [
        `the chain unreadable as ${reason} (503)`,
        api(503, [{ reason }]),
        reason === 'NotConfigured'
          ? 'notConfigured'
          : reason === 'WrongChain'
            ? 'wrongChain'
            : 'unreadable',
      ],
    ),
    ['a 503 with no reason at all', api(503), 'unreadable'],
    ['a status nothing documents', api(418), 'failed'],
    ['a request that never reached the API', api(0), 'failed'],
  ]

  it.each(outcomes)('maps %s to one state', (_label, given, expected) => {
    expect(identityActionState(given)).toBe(expected)
  })

  it('maps every outcome it is given to exactly one state', () => {
    for (const [label, given] of outcomes) {
      const first = identityActionState(given)

      expect(first, label).toEqual(expect.any(String))
      expect(identityActionState(given), label).toBe(first)
      expect(IDENTITY_ACTION_MESSAGE_KEY[first], label).toEqual(
        expect.any(String),
      )
    }
  })

  it('never reports a chain that could not be read as a refused document', () => {
    for (const reason of UNAVAILABLE) {
      expect(identityActionState(api(503, [{ reason }]))).not.toBe('refused')
    }
  })

  it('gives each state its own message and its own tone', () => {
    const keys = Object.values(IDENTITY_ACTION_MESSAGE_KEY)

    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.keys(IDENTITY_ACTION_TONE).sort()).toEqual(
      Object.keys(IDENTITY_ACTION_MESSAGE_KEY).sort(),
    )
    expect(
      Object.entries(IDENTITY_ACTION_TONE)
        .filter(([, tone]) => tone === 'success')
        .map(([state]) => state)
        .sort(),
    ).toEqual(['published', 'removed', 'withdrawn'])
  })
})

describe('identityApiOutcome', () => {
  it('reads the status and the first error the API documents', () => {
    expect(api(422, [{ reason: 'InvalidProof' }])).toEqual({
      kind: 'api',
      status: 422,
      reason: 'InvalidProof',
      result: null,
    })
    expect(api(409, [{ result: 'Superseded' }])).toEqual({
      kind: 'api',
      status: 409,
      reason: null,
      result: 'Superseded',
    })
  })

  it('reads a network failure with no response as status 0', () => {
    expect(identityApiOutcome(new Error('connection refused'))).toEqual({
      kind: 'api',
      status: 0,
      reason: null,
      result: null,
    })
  })
})

describe('identityViewState', () => {
  const base = { enabled: true, anchorable: true }

  it('says nothing is anchored here before it says anything else', () => {
    expect(identityViewState({ ...base, enabled: false, view: view() })).toBe(
      'unconfigured',
    )
  })

  it('says a non-EVM account cannot anchor at all', () => {
    expect(
      identityViewState({ ...base, anchorable: false, view: view() }),
    ).toBe('unanchorable')
  })

  it('has a state for an account with nothing hosted', () => {
    expect(identityViewState({ ...base, view: null })).toBe('none')
  })

  it.each(CHAIN_RESULTS)(
    'maps the chain answering %s to one state',
    (result) => {
      const state = identityViewState({ ...base, view: view({ result }) })

      expect(IDENTITY_VIEW_MESSAGE_KEY[state]).toEqual(expect.any(String))
      expect(state).toBe(
        result === 'Current'
          ? 'current'
          : result === 'Superseded'
            ? 'superseded'
            : result === 'Deactivated'
              ? 'withdrawn'
              : 'mismatch',
      )
    },
  )

  it('reads a superseded version of a withdrawn record as withdrawn', () => {
    expect(
      identityViewState({
        ...base,
        view: view({ result: 'Superseded', subjectDeactivated: true }),
      }),
    ).toBe('withdrawn')
  })

  it.each(UNAVAILABLE)(
    'says %s left the presentation unverified rather than wrong',
    (unavailable) => {
      expect(
        identityViewState({
          ...base,
          view: view({ result: null, subjectDeactivated: null, unavailable }),
        }),
      ).toBe('unverified')
    },
  )

  it('gives each view state its own message', () => {
    const keys = Object.values(IDENTITY_VIEW_MESSAGE_KEY)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('shows a chip only for a state a reader of someone else’s profile can use', () => {
    expect(isIdentityChipState('current')).toBe(true)
    expect(isIdentityChipState('none')).toBe(false)
    expect(isIdentityChipState('unconfigured')).toBe(false)
    expect(isIdentityChipState('unanchorable')).toBe(false)
  })
})
