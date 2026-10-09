import type { TimeTrackerConnectPhase } from './types'

type ConnectViewInput = {
  nonce: string | null
  phase: TimeTrackerConnectPhase
  authenticated: boolean
  authPending: boolean
  errorName: string | null
}

type ConnectScreen =
  | 'incomplete'
  | 'loading'
  | 'awaiting_auth'
  | 'signing_in'
  | 'pairing'
  | 'connected'
  | 'expired'
  | 'failed'

const COPY_BY_SCREEN: Record<
  ConnectScreen,
  { headingKey: string; descriptionKey: string }
> = {
  incomplete: {
    headingKey: 'connect.heading.incomplete',
    descriptionKey: 'connect.missingNonce',
  },
  loading: {
    headingKey: 'connect.heading.loading',
    descriptionKey: 'connect.description.loading',
  },
  awaiting_auth: {
    headingKey: 'connect.heading',
    descriptionKey: 'connect.description.default',
  },
  signing_in: {
    headingKey: 'connect.heading.signingIn',
    descriptionKey: 'connect.description.signingIn',
  },
  pairing: {
    headingKey: 'connect.heading.pairing',
    descriptionKey: 'connect.description.pairing',
  },
  connected: {
    headingKey: 'connect.heading.connected',
    descriptionKey: 'connect.description.connected',
  },
  expired: {
    headingKey: 'connect.heading.expired',
    descriptionKey: 'connect.description.expired',
  },
  failed: {
    headingKey: 'connect.heading.failed',
    descriptionKey: 'connect.description.failed',
  },
}

function getConnectScreen({
  nonce,
  phase,
  authenticated,
  authPending,
  errorName,
}: ConnectViewInput): ConnectScreen {
  if (!nonce) {
    return 'incomplete'
  }

  switch (phase) {
    case 'connected': {
      return 'connected'
    }
    case 'error': {
      return errorName === 'AuthenticationException' ||
        errorName === 'TimeTrackerException'
        ? 'expired'
        : 'failed'
    }
    case 'idle':
    case 'loading': {
      return 'loading'
    }
    case 'awaiting_pair':
    case 'connecting': {
      return 'pairing'
    }
    case 'awaiting_auth': {
      if (authenticated) {
        return 'pairing'
      }
      return authPending ? 'signing_in' : 'awaiting_auth'
    }
  }
}

/** Only a successfully checked nonce can offer sign-in or pairing. */
export function buildTimeTrackerConnectView(input: ConnectViewInput) {
  const screen = getConnectScreen(input)
  const showLoading =
    screen === 'loading' || screen === 'pairing' || screen === 'signing_in'
  const showError = screen === 'expired' || screen === 'failed'

  return {
    screen,
    ...COPY_BY_SCREEN[screen],
    showLoading,
    showError,
    checkingLink: screen === 'loading',
    showWalletProviders: screen === 'awaiting_auth',
    canRetry: screen === 'failed',
    showConnected: screen === 'connected',
  }
}
