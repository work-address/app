import styled from 'styled-components'

import type { ReactNode } from 'react'

import { PageSection, SectionTitle } from '@/shared'

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

/* Paper spaces its sections from the page's body instead, with no rule. */
const Root = styled(PageSection)`
  min-width: 0;

  @media print {
    padding-block: 0;
    border-top: 0;
  }
`

const Header = styled.header`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--space-3);
  padding: 0 0 var(--space-3);

  /* The table's own header rule is the line under this. */
  @media print {
    --font-size-4: 14px;
    --font-size-6: 14px;

    padding: 0 0 var(--space-1);
    break-after: avoid;
  }
`
