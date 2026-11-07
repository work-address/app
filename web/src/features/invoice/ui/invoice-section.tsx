import styled from 'styled-components'

import type { ReactNode } from 'react'

import { SectionTitle } from '@/shared'

type Props = {
  title: ReactNode
  /** Names the title, so the table under it can say it is labelled by it. */
  titleId?: string
  /** A short fact beside the title, such as a count. */
  meta?: ReactNode
  children: ReactNode
}

/** A titled band over its content, a hairline parting it from the one above. */
export const InvoiceSection = ({ title, titleId, meta, children }: Props) => (
  <Root>
    <Header>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {meta}
    </Header>
    {children}
  </Root>
)

/* A white workspace sheet on screen; paper spaces its sections from the
   page's body instead, with no box or rule. */
const Root = styled.section`
  min-width: 0;
  padding: var(--ui-card-inset);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--ui-card-inset-mobile);
  }

  @media print {
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
`

const Header = styled.header`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--ui-space-3);
  padding: 0 0 var(--ui-space-4);

  /* The table's own header rule is the line under this. */
  @media print {
    --section-title-size: 14px;

    padding: 0 0 var(--ui-space-1);
    break-after: avoid;
  }
`
