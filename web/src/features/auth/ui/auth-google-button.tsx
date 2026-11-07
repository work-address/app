import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeasure } from 'react-use'
import styled from 'styled-components'

import { AuthGoogleDemoButton } from './auth-google-demo-button'

import {
  $googleScriptAttempt,
  $googleScriptState,
  $googleSignInError,
  googleButtonFailed,
  googleScriptLoaded,
  googleScriptLoadFailed,
  loginGoogleFx,
  retryGoogleScript,
  type GoogleSignInError,
} from '@/entities/profile'
import { Button, DEMO_MODE, Spinner } from '@/shared'

type Props = {
  clientId: string
}

const GOOGLE_LOCALES: Record<string, string> = { zh: 'zh-CN' }

const ERROR_KEYS: Record<GoogleSignInError, string> = {
  emailTaken: 'signIn.errors.googleEmailTaken',
  emailUnverified: 'signIn.errors.googleEmailUnverified',
  failed: 'signIn.errors.google',
  unavailable: 'signIn.errors.googleUnavailable',
}

/**
 * Made of literals Vite inlines, like the guard in `main.tsx`: Google's button
 * can't work on a demo's made-up client ID, so the demo draws a stand-in, and a
 * plain build folds this to false and drops it.
 */
const DEMO_BUILD = import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true'

/**
 * Google's own branded, self-localized button rather than the panel's rows.
 * Its script loads only here, so a page that doesn't offer Google never asks
 * for it. If it can't load, the browser wallet beside it still works.
 */
export const AuthGoogleButton = ({ clientId }: Props) =>
  DEMO_BUILD && DEMO_MODE ? (
    <AuthGoogleDemoScript clientId={clientId} />
  ) : (
    <AuthGoogleScript clientId={clientId} />
  )

const AuthGoogleScript = ({ clientId }: Props) => {
  const { i18n } = useTranslation()
  const { attempt, loaded, failed } = useUnit({
    attempt: $googleScriptAttempt,
    loaded: googleScriptLoaded,
    failed: googleScriptLoadFailed,
  })

  return (
    <GoogleOAuthProvider
      key={attempt}
      clientId={clientId}
      locale={GOOGLE_LOCALES[i18n.language] ?? i18n.language}
      onScriptLoadSuccess={loaded}
      onScriptLoadError={failed}
    >
      <AuthGoogleControl />
    </GoogleOAuthProvider>
  )
}

/** The demo says through its client ID whether the script "loaded". */
const AuthGoogleDemoScript = ({ clientId }: Props) => {
  const { attempt, loaded, failed } = useUnit({
    attempt: $googleScriptAttempt,
    loaded: googleScriptLoaded,
    failed: googleScriptLoadFailed,
  })

  useEffect(() => {
    if (clientId === 'demo-script-failed') {
      failed()
    } else {
      loaded()
    }
  }, [attempt, clientId, failed, loaded])

  return <AuthGoogleControl />
}

const AuthGoogleControl = () => {
  const { t } = useTranslation()
  const { submit, retry, buttonFailed, scriptState, signingIn, error } =
    useUnit({
      submit: loginGoogleFx,
      retry: retryGoogleScript,
      buttonFailed: googleButtonFailed,
      scriptState: $googleScriptState,
      signingIn: loginGoogleFx.pending,
      error: $googleSignInError,
    })
  // Google sizes the button in pixels (capped at 400), so it is measured to
  // match the full-width rows around it without overflowing narrow screens.
  const [measureRef, { width }] = useMeasure<HTMLDivElement>()

  const signIn = (credential?: string | null) => {
    if (credential) {
      submit(credential).catch(() => {})
    } else {
      buttonFailed()
    }
  }

  return (
    <Root ref={measureRef} aria-busy={signingIn || scriptState === 'loading'}>
      {signingIn ? (
        <Status role="status">
          <Spinner size={20} />
          {t('localWallet.status.authorizing')}
        </Status>
      ) : scriptState === 'failed' ? (
        <>
          <Message role="alert">{t('signIn.errors.googleLoad')}</Message>
          <Button
            size="l"
            stretch
            variant="outline"
            color="neutral"
            onClick={retry}
          >
            {t('signIn.googleRetry')}
          </Button>
        </>
      ) : scriptState === 'loading' ? (
        <Status role="status">{t('signIn.googleLoading')}</Status>
      ) : DEMO_BUILD && DEMO_MODE ? (
        <AuthGoogleDemoButton onCredential={signIn} />
      ) : width > 0 ? (
        <GoogleLogin
          onError={buttonFailed}
          onSuccess={({ credential }) => signIn(credential)}
          shape="rectangular"
          size="large"
          text="continue_with"
          theme="filled_blue"
          width={String(Math.floor(Math.min(width, 400)))}
        />
      ) : null}
      {error && !signingIn && (
        <Message role="alert" data-tone="error">
          {t(ERROR_KEYS[error])}
        </Message>
      )}
    </Root>
  )
}

const Root = styled.div`
  width: 100%;
  min-height: 40px;
  display: grid;
  align-content: start;
  /* Google's button stops at 400px, which a wider column has to centre. */
  justify-items: center;
  gap: var(--ui-space-3);
`

const Status = styled.p`
  justify-self: stretch;
  min-height: 40px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-meta-size);
  color: var(--ui-muted);
`

const Message = styled.p`
  justify-self: stretch;
  margin: 0;
  font-size: var(--ui-meta-size);
  line-height: 1.45;
  color: var(--ui-muted);

  &[data-tone='error'] {
    color: var(--error-11);
  }
`
