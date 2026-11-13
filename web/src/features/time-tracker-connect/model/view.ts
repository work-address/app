import type { TimeTrackerConnectPhase } from './types'

type ConnectViewInput = {
  nonce: string | null
  phase: TimeTrackerConnectPhase
  authenticated: boolean
  authPending: boolean
  errorName: string | null
  /** Opened by the website's sign-in, not by the desktop time tracker. */
  fromWebsite?: boolean
  /** Opened by the phone app, which the connected screen sends back to. */
  fromPhone?: boolean
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

/** Someone signing in to the website has never heard of a time tracker. */
const WEBSITE_COPY_BY_SCREEN: typeof COPY_BY_SCREEN = {
  incomplete: {
    headingKey: 'connect.website.heading.incomplete',
    descriptionKey: 'connect.website.description.retry',
  },
  loading: {
    headingKey: 'connect.website.heading.loading',
    descriptionKey: 'connect.website.description.loading',
  },
  awaiting_auth: {
    headingKey: 'connect.website.title',
    descriptionKey: 'connect.website.description.default',
  },
  signing_in: {
    headingKey: 'connect.heading.signingIn',
    descriptionKey: 'connect.website.description.signingIn',
  },
  pairing: {
    headingKey: 'connect.heading.signingIn',
    descriptionKey: 'connect.website.description.signingIn',
  },
  connected: {
    headingKey: 'connect.website.heading.connected',
    descriptionKey: 'connect.website.description.connected',
  },
  expired: {
    headingKey: 'connect.website.heading.expired',
    descriptionKey: 'connect.website.description.retry',
  },
  failed: {
    headingKey: 'connect.website.heading.failed',
    descriptionKey: 'connect.description.failed',
  },
}

/** The tracker's words, but a phone is told to go back to the app. */
const PHONE_COPY_BY_SCREEN: typeof COPY_BY_SCREEN = {
  ...COPY_BY_SCREEN,
  connected: {
    headingKey: 'connect.phone.heading.connected',
    descriptionKey: 'connect.phone.description.connected',
  },
}

const copyFor = ({ fromWebsite, fromPhone }: ConnectViewInput) =>
  fromWebsite
    ? WEBSITE_COPY_BY_SCREEN
    : fromPhone
      ? PHONE_COPY_BY_SCREEN
      : COPY_BY_SCREEN

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
    ...copyFor(input)[screen],
    showLoading,
    showError,
    checkingLink: screen === 'loading',
    showWalletProviders: screen === 'awaiting_auth',
    canRetry: screen === 'failed',
    // Screens nothing on the page can fix still lead somewhere: the app, or
    // signing in to it, instead of a dead end.
    showWayOn: screen === 'incomplete' || screen === 'expired',
    showConnected: screen === 'connected',
    // The phone's way back to the app; the website's and the tracker's
    // connected screens have their own.
    showReturnToApp: Boolean(input.fromPhone) && screen === 'connected',
  }
}
