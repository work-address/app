import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  label: ReactNode
  value: ReactNode
  /** An affordance at the row's end, such as an external-link arrow. */
  trailing?: ReactNode
}

/** One contact fact: an icon tile, a small label, and the value under it. */
export const ProfileViewInfoRow = ({ icon, label, value, trailing }: Props) => (
  <Root>
    <Icon>{icon}</Icon>
    <Body>
      <Label>{label}</Label>
      <Value>{value}</Value>
    </Body>
    {trailing ? <Trailing>{trailing}</Trailing> : null}
  </Root>
)

const Root = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-3);
  padding-block: var(--ui-space-3);

  & + & {
    border-top: var(--ui-border-width) solid var(--ui-line);
  }

  /* The panel's own spacing already sets the list off at either end. */
  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }
`

const Icon = styled.span`
  display: grid;
  place-items: center;
  width: var(--ui-control-height);
  height: var(--ui-control-height);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  color: var(--ui-blue);

  svg {
    width: var(--ui-icon-size);
    height: var(--ui-icon-size);
  }
`

const Body = styled.div`
  display: grid;
  min-width: 0;
`

const Label = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

/* An email or a handle has no break opportunities of its own; without this a
   long one pushes the page wider than the phone. */
const Value = styled.span`
  min-width: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-medium);
  overflow-wrap: anywhere;

  a {
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    color: var(--ui-blue);
    text-decoration: underline;
  }

  a:focus-visible {
    border-radius: var(--ui-inline-radius);
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`

const Trailing = styled.span`
  display: grid;
  color: var(--ui-muted);
`
