import styled from 'styled-components'

import type { ReactNode } from 'react'

import { Text } from '@/shared'

type ProfileViewInfoRowProps = {
  icon?: ReactNode
  text?: ReactNode
  hoverEffects?: boolean
}

export const ProfileViewInfoRow = ({
  text,
  icon,
  hoverEffects = true,
}: ProfileViewInfoRowProps) => {
  return (
    <Root>
      <Icon>{icon}</Icon>
      <Value
        size={{ initial: '2', md: '3' }}
        data-hover-effects={hoverEffects || undefined}
      >
        {text}
      </Value>
    </Root>
  )
}

/* Top-aligned, so a value that wraps keeps its icon on its first line and the
   rows beside it stay level with that line. */
const Root = styled.div`
  align-self: start;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-space-2);
`

/* As tall as a line of the row's text, so the icon centres on the first one. */
const Icon = styled.div`
  display: grid;
  place-items: center;
  height: var(--ui-body-line-height);
  color: var(--ui-muted);

  ${(p) => p.theme.breakpoints.down('md')} {
    height: var(--ui-meta-line-height);
  }
`

/* An email or a handle has no break opportunities of its own; without this a
   long one pushes the page wider than the phone. */
const Value = styled(Text)`
  justify-self: start;
  min-width: 0;
  overflow-wrap: anywhere;

  &[data-hover-effects] {
    border-bottom: 1px solid transparent;
    transition: border-bottom 0.2s ease-in-out;

    &:hover {
      border-bottom: 1px solid var(--ui-line);
    }
  }
`
