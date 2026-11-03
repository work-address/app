import { LockOpen1Icon, PersonIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Frame } from './auth-styles'

import type { ReactNode } from 'react'

type Props = {
  /** Only then is there a second kind of account to tell apart. */
  googleOffered: boolean
  className?: string
}

/**
 * Under both ways in, because all of it holds for both: the two kinds of account
 * never meet, and signing in costs nothing. On the same grid as the panels above.
 */
export const AuthSignInFoot = ({ googleOffered, className }: Props) => {
  const { t } = useTranslation()

  return (
    <Root className={className}>
      <Content data-layout={googleOffered ? 'split' : 'single'}>
        {googleOffered && (
          <Note
            icon={<PersonIcon />}
            title={t('signIn.foot.separateTitle')}
            text={t('signIn.foot.separate')}
          />
        )}
        <Note
          icon={<LockOpen1Icon />}
          title={t('signIn.foot.freeTitle')}
          text={t('signIn.foot.free')}
        />
      </Content>
    </Root>
  )
}

const Note = ({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) => (
  <NoteRoot>
    <NoteIcon aria-hidden="true">{icon}</NoteIcon>
    <NoteBody>
      <NoteTitle>{title}</NoteTitle>
      <NoteText>{text}</NoteText>
    </NoteBody>
  </NoteRoot>
)

const Root = styled.footer`
  padding: var(--space-4);
  border-top: 1px solid var(--ds-neutral-alpha-6);
  background: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    padding: var(--space-4) var(--space-7);
  }
`

/* Each note sits under the column above it. */
const Content = styled(Frame)`
  display: grid;
  gap: var(--space-3);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    justify-content: center;

    &[data-layout='single'] {
      grid-template-columns: minmax(0, 400px);
    }

    &[data-layout='split'] {
      grid-template-columns: repeat(2, minmax(0, 400px));
      justify-content: space-between;
    }
  }
`

const NoteRoot = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
`

const NoteIcon = styled.span`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--ds-accent-3);
  color: var(--ds-accent-11);
`

const NoteBody = styled.p`
  margin: 0;
  display: grid;
  font-size: var(--font-size-1);
  line-height: 18px;
`

const NoteTitle = styled.span`
  font-weight: 600;
  color: var(--ds-neutral-12);
`

const NoteText = styled.span`
  color: var(--ds-neutral-11);
`
