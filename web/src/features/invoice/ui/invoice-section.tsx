import styled from 'styled-components'

import type { ReactNode } from 'react'

import { Card, SectionTitle } from '@/shared'

type Props = {
  title: ReactNode
  /** Names the title, so the table under it can say it is labelled by it. */
  titleId?: string
  /** A short fact beside the title, such as a count. */
  meta?: ReactNode
  children: ReactNode
}

/** A titled band over its content, one card with one edge. */
export const InvoiceSection = ({ title, titleId, meta, children }: Props) => (
  <Root>
    <Header>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {meta}
    </Header>
    {children}
  </Root>
)

/* On a phone the card is the page, as the profile's and the edit form's are. */
const Root = styled(Card)`
  min-width: 0;
  padding: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    &[data-shadow] {
      box-shadow: none;
    }
  }

  @media print {
    &[data-shadow] {
      box-shadow: none;
    }
  }
`

const Header = styled.header`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 0 0 var(--space-3);
  }

  @media print {
    padding: 0 0 var(--space-2);
  }
`
