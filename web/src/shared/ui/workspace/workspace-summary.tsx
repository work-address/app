import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Five metrics on desktop, two columns below xl; false is one metric. */
  detail?: boolean
  className?: string
}

/** A shared surface for WorkspaceMetric definition-list groups. */
export const WorkspaceSummary = ({
  children,
  detail = true,
  className,
}: Props) => (
  <Root className={className} data-detail={detail || undefined}>
    {children}
  </Root>
)

const Root = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-section-gap) 0;
  margin: 0;
  padding: var(--ui-card-inset) var(--ui-space-2);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  &[data-detail] {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    &[data-detail] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding-block: var(--ui-space-4);
  }
`
