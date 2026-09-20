import type { baseApi } from '@/shared'

/** The hosted presentation and the chain's answer, as the API returns it. */
export type IdentityView = baseApi.UserControllerReadIdentityResponse

export type IdentityStatus = IdentityView['status']

/** `IdentityRegistry.Presentation`, from the generated client. */
export type IdentityChainResult = NonNullable<IdentityStatus['result']>

/** Why no chain answer could be had, from the generated client. */
export type IdentityUnavailable = NonNullable<IdentityStatus['unavailable']>

/** What went wrong in the browser, before the API was ever asked. */
export type IdentityWalletFailure =
  /** The holder declined the transaction in their wallet. */
  | 'declined'
  /** The browser wallet could not be unlocked. */
  | 'locked'
  /** This browser has no RPC endpoint to send the transaction through. */
  | 'noEndpoint'
  /** The endpoint answers as another chain than the registry's. */
  | 'wrongChain'
  /** The transaction failed for any other reason. */
  | 'failed'

/**
 * Every way a publish or a withdraw can end. Exactly one of these reaches the
 * card, and the card shows exactly one thing for it.
 */
export type IdentityActionOutcome =
  /** PUT /user/identity accepted the presentation. */
  | { kind: 'published' }
  /** `deactivate` was mined, so the registry no longer holds the record. */
  | { kind: 'withdrawn' }
  /** DELETE /user/identity took the hosted copy down. */
  | { kind: 'removed' }
  | { kind: 'wallet'; code: IdentityWalletFailure }
  | {
      kind: 'api'
      status: number
      /** `errors[0].reason`, a refusal or an unavailability. */
      reason: string | null
      /** `errors[0].result`, the chain's answer on a 409. */
      result: IdentityChainResult | null
    }

/**
 * What the card says after an action. One state per outcome, and one message
 * per state: a holder who is told "the registry could not be read" must never
 * be told the same thing as one whose proof did not open.
 */
export type IdentityActionState =
  | 'published'
  | 'withdrawn'
  | 'removed'
  | 'declined'
  | 'locked'
  | 'noEndpoint'
  | 'wrongChain'
  | 'notConfigured'
  | 'unreadable'
  | 'notAnchorable'
  | 'notSubject'
  | 'stale'
  | 'refused'
  | 'failed'

/** 422 reasons that are not about the document at all. */
const NOT_ANCHORABLE = 'UnsupportedSubjectScheme'

/** 503 reasons, as IdentityUnavailableException names them. */
const UNAVAILABLE_STATE: Record<IdentityUnavailable, IdentityActionState> = {
  NotConfigured: 'notConfigured',
  RpcUnavailable: 'unreadable',
  WrongChain: 'wrongChain',
}

const WALLET_STATE: Record<IdentityWalletFailure, IdentityActionState> = {
  declined: 'declined',
  locked: 'locked',
  noEndpoint: 'noEndpoint',
  wrongChain: 'wrongChain',
  failed: 'failed',
}

/** The states the identity routes' own statuses stand for. */
const apiState = (
  status: number,
  reason: string | null,
): IdentityActionState => {
  if (status === 403) {
    return 'notSubject'
  }

  // The registry's state forbids hosting it, whichever state that is:
  // superseded, withdrawn, another commitment. The card shows the chain's own
  // word for it beside the one message.
  if (status === 409) {
    return 'stale'
  }

  if (status === 422) {
    return reason === NOT_ANCHORABLE ? 'notAnchorable' : 'refused'
  }

  // Never a verdict on the presentation: nothing is known about it yet.
  if (status === 503) {
    return UNAVAILABLE_STATE[reason as IdentityUnavailable] ?? 'unreadable'
  }

  return 'failed'
}

/**
 * The single state an outcome puts the card in. Total by construction: an
 * unrecognised status is `failed`, never nothing, so no result can leave the
 * card showing the state of the one before it.
 */
export const identityActionState = (
  outcome: IdentityActionOutcome,
): IdentityActionState => {
  switch (outcome.kind) {
    case 'published': {
      return 'published'
    }
    case 'withdrawn': {
      return 'withdrawn'
    }
    case 'removed': {
      return 'removed'
    }
    case 'wallet': {
      return WALLET_STATE[outcome.code] ?? 'failed'
    }
    case 'api': {
      return apiState(outcome.status, outcome.reason)
    }
  }
}

/**
 * A failed identity request as an outcome. Read structurally rather than
 * through `instanceof AxiosError` so the mapping stays a pure function over
 * the response the API documents: `status`, and `errors[0]` carrying either
 * a refusal `reason` or the chain's `result`.
 */
export const identityApiOutcome = (error: unknown): IdentityActionOutcome => {
  const response = (error as { response?: unknown } | null)?.response as
    | { status?: unknown; data?: unknown }
    | undefined
  const status = typeof response?.status === 'number' ? response.status : 0
  const first = (response?.data as { errors?: unknown[] } | undefined)
    ?.errors?.[0] as { reason?: unknown; result?: unknown } | undefined

  return {
    kind: 'api',
    status,
    reason: typeof first?.reason === 'string' ? first.reason : null,
    result:
      typeof first?.result === 'string'
        ? (first.result as IdentityChainResult)
        : null,
  }
}

/** One message per state, so two different failures never read the same. */
export const IDENTITY_ACTION_MESSAGE_KEY: Record<IdentityActionState, string> =
  {
    published: 'identity.action.published',
    withdrawn: 'identity.action.withdrawn',
    removed: 'identity.action.removed',
    declined: 'identity.action.declined',
    locked: 'identity.action.locked',
    noEndpoint: 'identity.action.noEndpoint',
    wrongChain: 'identity.action.wrongChain',
    notConfigured: 'identity.action.notConfigured',
    unreadable: 'identity.action.unreadable',
    notAnchorable: 'identity.action.notAnchorable',
    notSubject: 'identity.action.notSubject',
    stale: 'identity.action.stale',
    refused: 'identity.action.refused',
    failed: 'identity.action.failed',
  }

/** Whether the state is something that went right. */
export const IDENTITY_ACTION_TONE: Record<
  IdentityActionState,
  'success' | 'error'
> = {
  published: 'success',
  withdrawn: 'success',
  removed: 'success',
  declined: 'error',
  locked: 'error',
  noEndpoint: 'error',
  wrongChain: 'error',
  notConfigured: 'error',
  unreadable: 'error',
  notAnchorable: 'error',
  notSubject: 'error',
  stale: 'error',
  refused: 'error',
  failed: 'error',
}

/**
 * What the card rests on: what this instance knows about the holder's
 * anchored profile right now.
 */
export type IdentityViewState =
  /** This instance anchors nowhere, so there is nothing to publish to. */
  | 'unconfigured'
  /** IdentityRegistry keys records by an EVM address; this account has none. */
  | 'unanchorable'
  /** Nothing is hosted here. */
  | 'none'
  /** Hosted, and the registry holds it as the subject's current version. */
  | 'current'
  /** Hosted, but the holder has published a newer version since. */
  | 'superseded'
  /** The holder withdrew the record on chain. */
  | 'withdrawn'
  /** The registry does not hold this commitment at this version. */
  | 'mismatch'
  /** The chain could not be read; nothing is claimed about the presentation. */
  | 'unverified'

const RESULT_STATE: Record<IdentityChainResult, IdentityViewState> = {
  Current: 'current',
  Superseded: 'superseded',
  Deactivated: 'withdrawn',
  Unpublished: 'mismatch',
  VersionUnknown: 'mismatch',
  CommitmentMismatch: 'mismatch',
  SchemaMismatch: 'mismatch',
}

export const identityViewState = (input: {
  enabled: boolean
  anchorable: boolean
  view: IdentityView | null
}): IdentityViewState => {
  if (!input.enabled) {
    return 'unconfigured'
  }

  if (!input.anchorable) {
    return 'unanchorable'
  }

  if (!input.view) {
    return 'none'
  }

  const { result, subjectDeactivated } = input.view.status

  if (result === null) {
    return 'unverified'
  }

  // A superseded version of a withdrawn record reads as withdrawn, not merely
  // out of date: the whole record is gone, not just this version of it.
  return subjectDeactivated ? 'withdrawn' : RESULT_STATE[result]
}

export const IDENTITY_VIEW_MESSAGE_KEY: Record<IdentityViewState, string> = {
  unconfigured: 'identity.state.unconfigured',
  unanchorable: 'identity.state.unanchorable',
  none: 'identity.state.none',
  current: 'identity.state.current',
  superseded: 'identity.state.superseded',
  withdrawn: 'identity.state.withdrawn',
  mismatch: 'identity.state.mismatch',
  unverified: 'identity.state.unverified',
}

/** The chip on a public profile shows only a state a reader can act on. */
export const IDENTITY_CHIP_STATES: readonly IdentityViewState[] = [
  'current',
  'superseded',
  'withdrawn',
  'mismatch',
  'unverified',
]

export const isIdentityChipState = (state: IdentityViewState): boolean =>
  IDENTITY_CHIP_STATES.includes(state)
