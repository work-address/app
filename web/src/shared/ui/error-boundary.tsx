import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router-dom'
import styled from 'styled-components'

import { Button } from './button'
import { PageHelmet } from './page-helmet'
import { StateNotice } from './state-screens/state-notice'

/**
 * What a crash looks like. Unknown paths no longer land here - the router's
 * catch-all renders the not-found page inside the app shell - so this is only
 * for a render or loader that threw, and the honest way on is a reload.
 */
export const ErrorBoundary = () => {
  const { t } = useTranslation()
  const error = useRouteError() as Error | undefined

  return (
    <Root>
      <PageHelmet title={t('crash.documentTitle')} noindex />
      <StateNotice
        size="page"
        tone="error"
        title={t('crash.title')}
        description={
          <>
            {t('crash.description')}
            {import.meta.env.DEV && error?.message ? (
              <Detail>{error.message}</Detail>
            ) : null}
          </>
        }
        actions={
          <Button size="l" onClick={() => window.location.reload()}>
            {t('crash.reload')}
          </Button>
        }
      />
    </Root>
  )
}

const Root = styled.main`
  display: grid;
  align-content: center;
  min-height: 100vh;
  padding: 32px 28px;
  background: var(--white);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 18px 16px;
  }
`

const Detail = styled.code`
  display: block;
  margin-top: var(--space-2);
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
`
