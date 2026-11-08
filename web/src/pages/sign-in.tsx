import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import {
  $authMethodsState,
  $authenticated,
  $googleClientId,
  $lastSignInMethod,
  fetchAuthMethodsFx,
  loginGoogleFx,
} from '@/entities/profile'
import {
  AuthGooglePanel,
  AuthWalletPanel,
  AuthWelcomeStory,
} from '@/features/auth'
import {
  LOCAL_WALLET_STEP_TITLE_KEY,
  useLocalWalletFlow,
} from '@/features/local-wallet'
import { returnPathFrom, routes } from '@/routes'
import { Button, LogoLabel, PageHelmet, StateNotice } from '@/shared'

/**
 * A white sign-in card beside a welcome to the workspace. The card offers
 * Google, where the deployment does, then the browser wallet run in place.
 * Once someone starts on a new wallet the card narrows to that one step, and
 * Back returns to the choice. While one way is busy the other is held back.
 */
export default function SignInPage() {
  const { t } = useTranslation()
  const {
    authenticated,
    googleClientId,
    methodsState,
    lastMethod,
    googleSigningIn,
    fetchMethods,
  } = useUnit({
    authenticated: $authenticated,
    googleClientId: $googleClientId,
    methodsState: $authMethodsState,
    lastMethod: $lastSignInMethod,
    googleSigningIn: loginGoogleFx.pending,
    fetchMethods: fetchAuthMethodsFx,
  })
  const flow = useLocalWalletFlow()
  const version = import.meta.env.VITE_GIT_COMMIT_SUFFIX
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  const loadMethods = useCallback(() => {
    fetchMethods().catch(() => {})
  }, [fetchMethods])

  useEffect(loadMethods, [loadMethods])

  if (nonce) {
    return <Navigate to={routes.connect.build({ nonce })} replace />
  }

  if (authenticated) {
    return (
      <Navigate
        to={returnPathFrom(location.state) ?? routes.dashboard.build()}
        replace
      />
    )
  }

  const failed = methodsState === 'failed'
  const landing = flow.step === 'choose' || flow.step === 'unlock'
  const googleOffered =
    methodsState === 'loading' || (methodsState === 'ready' && !!googleClientId)
  // Only worth saying when there is a choice. A forgotten wallet can't be used
  // again, so it isn't marked over the offer to make a new one.
  const hasChoice = methodsState === 'ready' && !!googleClientId

  return (
    <>
      <PageHelmet title={t('signIn.title')} description={t('signIn.meta')} />
      <Root>
        <Top>
          <Logo src={LogoLabel} alt={t('signIn.logoAlt')} />
          <Help to={routes.docs.build()} target={routes.docs.target}>
            <QuestionMarkCircledIcon aria-hidden="true" />
            {t('signIn.learnMore')}
          </Help>
        </Top>
        <Body>
          <AuthWelcomeStory />
          <Card>
            <Heading>
              {landing && <Eyebrow>{t('signIn.card.eyebrow')}</Eyebrow>}
              <Title>
                {t(
                  landing
                    ? 'signIn.title'
                    : LOCAL_WALLET_STEP_TITLE_KEY[flow.step],
                )}
              </Title>
              {landing && !failed && <Lead>{t('signIn.lead')}</Lead>}
            </Heading>
            {failed ? (
              /* The wallet signs in through the same API, so it can't be
                 offered as a way round this. */
              <StateNotice
                tone="error"
                title={t('signIn.unavailable.title')}
                description={t('signIn.unavailable.description')}
                actions={
                  <Button onClick={loadMethods}>
                    {t('signIn.googleRetry')}
                  </Button>
                }
              />
            ) : (
              <>
                {landing && googleOffered && (
                  <>
                    <Option
                      data-held={flow.busy || undefined}
                      inert={flow.busy}
                    >
                      <AuthGooglePanel
                        clientId={googleClientId}
                        lastUsed={hasChoice && lastMethod === 'google'}
                      />
                    </Option>
                    <Or aria-hidden="true">
                      <span>{t('signIn.walletDivider')}</span>
                    </Or>
                  </>
                )}
                <Option
                  data-held={googleSigningIn || undefined}
                  inert={googleSigningIn}
                >
                  <AuthWalletPanel
                    flow={flow}
                    lastUsed={
                      hasChoice && lastMethod === 'wallet' && !!flow.wallet
                    }
                  />
                </Option>
              </>
            )}
          </Card>
        </Body>
        <Footer>
          <span>{t('signIn.footer')}</span>
          {version && (
            <Version>
              {t('signIn.version')} {version}
            </Version>
          )}
        </Footer>
      </Root>
    </>
  )
}

/* The welcome beside a white sign-in card on the canvas; on a phone the
   heading sits above the card and the page scrolls as one. */
const Root = styled.div`
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--ui-space-6);
  padding: var(--ui-space-5) var(--ui-space-4);
  background: var(--page-canvas);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    gap: var(--ui-space-7);
    padding: var(--ui-space-6) var(--ui-page-inset);
  }
`

const Top = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;
`

const Logo = styled.img`
  display: block;
  width: auto;
  height: 26px;
`

const Help = styled(Link)`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-meta-size);
  font-weight: var(--ui-weight-medium);
  color: var(--ui-muted);
  text-decoration: none;

  &:hover {
    color: var(--ui-blue);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
    border-radius: var(--ui-inline-radius);
  }
`

const Body = styled.div`
  display: grid;
  align-content: center;
  gap: var(--ui-space-5);
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    grid-template-columns: minmax(0, 1fr) calc(400px + 2 * var(--ui-card-inset));
    align-items: center;
    gap: var(--ui-space-8);
  }
`

/* Google draws its button at most 400px wide, so the card's column is that
   wide and every other row lines up with it. */
const Card = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-space-5);
  width: 100%;
  max-width: calc(400px + 2 * var(--ui-card-inset));
  justify-self: center;
  padding: var(--ui-space-6) var(--ui-card-inset-mobile);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    padding: var(--ui-space-7) var(--ui-card-inset);
  }
`

const Heading = styled.div`
  display: grid;
  gap: var(--ui-space-2);
`

const Eyebrow = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  font-weight: var(--ui-eyebrow-weight);
  letter-spacing: var(--ui-eyebrow-tracking);
  text-transform: uppercase;
`

const Title = styled.h1`
  margin: 0;
  font-size: var(--ui-title-mobile-size);
  font-weight: var(--ui-title-weight);
  line-height: var(--ui-title-mobile-line-height);
  letter-spacing: var(--ui-title-tracking);
  color: var(--ui-ink);
`

const Lead = styled.p`
  margin: 0;
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  color: var(--ui-muted);
`

const Option = styled.section`
  transition: opacity 0.2s ease;

  &[data-held] {
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Or = styled.div`
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  font-size: var(--ui-small-size);
  color: var(--ui-muted);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: var(--ui-border-width);
    background: var(--ui-line);
  }
`

const Footer = styled.footer`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ui-space-2) var(--ui-space-4);
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

const Version = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
`
