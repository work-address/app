import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  iconUrl: string
  /** Who this way in suits, so nobody has to know the terms to choose. */
  eyebrow?: string
  title: string
  lead?: string
  /** What the person acts on: the button, or the step they're on. */
  children: ReactNode
  /** What happens after they act. Left out once they're past choosing. */
  after?: ReactNode
}

/** One way in, set out the same on each half so the two compare at a glance. */
export const AuthMethod = ({
  iconUrl,
  eyebrow,
  title,
  lead,
  children,
  after,
}: Props) => (
  <Root>
    <Header>
      <Mark>
        <img src={iconUrl} alt="" width={24} height={24} />
      </Mark>
      <Heading>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Title>{title}</Title>
      </Heading>
    </Header>
    {lead && <Lead>{lead}</Lead>}
    <Action>{children}</Action>
    {after && <After>{after}</After>}
  </Root>
)

const Root = styled.div`
  display: grid;
  gap: var(--space-5);
`

const Header = styled.header`
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
`

const Mark = styled.span`
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-4);
  background: var(--white);
`

const Heading = styled.div`
  display: grid;
  gap: 2px;
`

const Eyebrow = styled.p`
  margin: 0;
  font-size: var(--font-size-1);
  font-weight: 600;
  line-height: 16px;
  color: var(--ds-accent-11);
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--font-size-6);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ds-neutral-12);
`

/* Two lines tall on a desktop whatever it holds, so the first control on each
   half sits on one line. */
const Lead = styled.p`
  margin: 0;
  font-size: var(--font-size-3);
  line-height: 1.5;
  color: var(--ds-neutral-11);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 3em;
  }
`

/* Room for a button and a line under it, so what follows lines up across the
   halves too. */
const Action = styled.div`
  display: grid;
  align-content: start;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 72px;
  }
`

const After = styled.div`
  padding-top: var(--space-5);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`
