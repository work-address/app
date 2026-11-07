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
  AuthBrandPanel,
  AuthGooglePanel,
  AuthWalletPanel,
} from '@/features/auth'
import {
  LOCAL_WALLET_STEP_TITLE_KEY,
  useLocalWalletFlow,
} from '@/features/local-wallet'
import { returnPathFrom, routes } from '@/routes'
import { Button, LogoLabel, PageHelmet, StateNotice } from '@/shared'

/**
 * One form column beside a brand panel. The column offers Google, where the
 * deployment does, then the browser wallet run in place. Once someone starts on
 * a new wallet the form narrows to that one step, and Back returns to the choice.
 * While one way is busy the other is held back.
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
        <FormSide>
          <Top>
            <Logo src={LogoLabel} alt={t('signIn.logoAlt')} />
            <TopActions>
              {version && (
                <Version>
                  {t('signIn.version')} {version}
                </Version>
              )}
              <Help to={routes.docs.build()} target={routes.docs.target}>
                <QuestionMarkCircledIcon aria-hidden="true" />
                {t('signIn.learnMore')}
              </Help>
            </TopActions>
          </Top>
          <Column>
            <Heading>
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
                      <span>{t('signIn.local.or')}</span>
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
          </Column>
        </FormSide>
        <BrandSide>
          <AuthBrandPanel />
        </BrandSide>
      </Root>
    </>
  )
}

/* One column that scrolls on a phone. On a desktop the screen is pinned to the
   viewport, and the form side scrolls if a form outgrows a short window. */
const Root = styled.div`
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--page-canvas);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    height: 100dvh;
    min-height: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
  }
`

const FormSide = styled.main`
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--ui-space-5);
  padding: var(--ui-space-4);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 0;
    overflow-y: auto;
    padding: var(--ui-space-6) var(--ui-space-7);
  }
`

const Top = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
`

const Logo = styled.img`
  display: block;
  width: auto;
  height: 26px;
`

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
`

const Version = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--ui-small-size);
  white-space: nowrap;
  color: var(--ui-muted);

  ${({ theme }) => theme.breakpoints.down('lg')} {
    display: none;
  }
`

const Help = styled(Link)`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-meta-size);
  font-weight: 500;
  color: var(--ui-blue);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-blue);
    outline-offset: 2px;
    border-radius: 2px;
  }
`

/* Auto margins centre it in the room left, and give way when it outgrows that. */
const Column = styled.div`
  width: 100%;
  max-width: 400px;
  margin: auto;
  display: grid;
  gap: var(--ui-space-5);
`

const Heading = styled.div`
  display: grid;
  gap: var(--ui-space-2);
`

const Title = styled.h1`
  margin: 0;
  font-size: var(--ui-title-mobile-size);
  font-weight: var(--ui-title-weight);
  line-height: var(--ui-title-mobile-line-height);
  letter-spacing: var(--ui-title-tracking);
  color: var(--ui-ink);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    font-size: var(--ui-title-size);
    line-height: var(--ui-title-line-height);
  }
`

const Lead = styled.p`
  margin: 0;
  font-size: var(--ui-description-size);
  line-height: var(--ui-description-line-height);
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
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-muted);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ui-line);
  }
`

/* Decoration, so it goes first on a phone: the sign-in options need the room. */
const BrandSide = styled.div`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: grid;
    min-height: 0;
    padding: var(--ui-space-6) var(--ui-space-6) var(--ui-space-6) 0;
  }
`
