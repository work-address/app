import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Learn } from './auth-styles'

import { routes } from '@/routes'

type Props = {
  /** Only then is there a second kind of account to tell apart. */
  googleOffered: boolean
  className?: string
}

/**
 * Under both ways in, because all of it holds for both: there is no separate
 * sign-up, the two kinds of account never meet, and signing in costs nothing.
 */
export const AuthSignInFoot = ({ googleOffered, className }: Props) => {
  const { t } = useTranslation()
  const version = import.meta.env.VITE_GIT_COMMIT_SUFFIX

  return (
    <Root className={className}>
      <Main>
        {t('signIn.foot.new')}
        {googleOffered && <> {t('signIn.foot.separate')}</>}
      </Main>
      <Fine>
        <span>{t('signIn.foot.free')}</span>
        <Learn to={routes.docs.build()} target={routes.docs.target}>
          {t('signIn.learnMore')}
        </Learn>
        {version && (
          <span>
            {t('signIn.version')}: <Version>{version}</Version>
          </span>
        )}
      </Fine>
    </Root>
  )
}

const Root = styled.footer`
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
  border-top: 1px solid var(--ds-neutral-alpha-6);
  text-align: center;
`

const Main = styled.p`
  margin: 0;
  font-size: var(--font-size-2);
  line-height: 1.5;
  color: var(--ds-neutral-12);
`

const Fine = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 var(--space-3);
  font-size: var(--font-size-1);
  line-height: 1.5;
  color: var(--ds-neutral-11);
`

const Version = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
`
