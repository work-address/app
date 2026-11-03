import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { useMeasure } from 'react-use'
import styled from 'styled-components'

import {
  $googleScriptAttempt,
  $googleScriptState,
  $pending,
  googleScriptLoaded,
  googleScriptLoadFailed,
  loginGoogleFx,
  retryGoogleScript,
} from '@/entities/profile'
import { showToast } from '@/shared'

type Props = {
  clientId: string
  onMouseEnter?: () => void
}

const GOOGLE_LOCALES: Record<string, string> = { zh: 'zh-CN' }

/**
 * Google's own branded, self-localized button rather than the panel's rows.
 * Its script loads only here, so a page that doesn't offer Google never asks
 * for it. If it can't load, the browser wallet beside it still works.
 */
export const AuthGoogleButton = ({ clientId, onMouseEnter }: Props) => {
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
      <AuthGoogleControl onMouseEnter={onMouseEnter} />
    </GoogleOAuthProvider>
  )
}

const AuthGoogleControl = ({ onMouseEnter }: Pick<Props, 'onMouseEnter'>) => {
  const { t } = useTranslation()
  const { submit, retry, scriptState, pending } = useUnit({
    submit: loginGoogleFx,
    retry: retryGoogleScript,
    scriptState: $googleScriptState,
    pending: $pending,
  })
  // Google sizes the button in pixels (capped at 400), so it is measured to
  // match the full-width rows around it without overflowing narrow screens.
  const [measureRef, { width }] = useMeasure<HTMLDivElement>()

  const reportFailure = () => {
    showToast('error', {
      message: t('signIn.errors.google'),
      position: 'top-center',
    })
  }

  return (
    <Root
      ref={measureRef}
      aria-busy={pending || scriptState === 'loading'}
      inert={pending}
      onMouseEnter={onMouseEnter}
    >
      {scriptState === 'failed' ? (
        <>
          <Hint role="alert">{t('signIn.errors.googleLoad')}</Hint>
          <Retry type="button" onClick={retry}>
            {t('signIn.googleRetry')}
          </Retry>
        </>
      ) : scriptState === 'loading' ? (
        <Hint role="status">{t('signIn.googleLoading')}</Hint>
      ) : width > 0 ? (
        <GoogleLogin
          onError={reportFailure}
          onSuccess={({ credential }) => {
            if (credential) {
              submit(credential).catch(() => {})
            } else {
              reportFailure()
            }
          }}
          shape="rectangular"
          size="large"
          text="continue_with"
          theme="outline"
          width={String(Math.floor(Math.min(width, 400)))}
        />
      ) : null}
    </Root>
  )
}

const Root = styled.div`
  width: 100%;
  min-height: 40px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--space-2);

  &[aria-busy='true'] {
    opacity: 0.7;
  }
`

const Hint = styled.p`
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--ds-neutral-11);
  text-align: center;
`

const Retry = styled.button`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  color: var(--ds-accent-11);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`
