import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthGoogleButton } from './auth-google-button'

type Props = {
  /** Unknown until the deployment has said whether it offers Google. */
  clientId: string | null
}

/**
 * The sign-in page's Google half. Holds its place while the deployment answers,
 * so the page doesn't draw a wallet-only screen and then snap into two halves.
 */
export const AuthGooglePanel = ({ clientId }: Props) => {
  const { t } = useTranslation()

  if (!clientId) {
    return (
      <Root aria-hidden="true">
        <Header>
          <Skeleton width="70%" height="32px" loading />
          <Skeleton width="85%" height="20px" loading />
        </Header>
        <Skeleton width="100%" height="40px" loading />
      </Root>
    )
  }

  return (
    <Root>
      <Header>
        <Title>{t('signIn.google.title')}</Title>
        <Lead>{t('signIn.google.lead')}</Lead>
      </Header>
      <AuthGoogleButton clientId={clientId} />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-5);
`

const Header = styled.header`
  display: grid;
  gap: var(--space-2);
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--font-size-6);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ds-neutral-12);
`

const Lead = styled.p`
  margin: 0;
  font-size: var(--font-size-3);
  line-height: 1.5;
  color: var(--ds-neutral-11);

  /* As tall as the wallet's two-line lead across the page, so the first button
     on each side sits on one line. */
  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 3em;
  }
`
