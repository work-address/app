import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Five metrics on desktop, two columns below xl; false is one metric. */
  detail?: boolean
  /**
   * Another metric count on one desktop row. Phones list every summary's
   * metrics one per row, since amounts side by side would break mid-number.
   */
  columns?: 2 | 3 | 4
  className?: string
}

/** A shared surface for WorkspaceMetric definition-list groups. */
export const WorkspaceSummary = ({
  children,
  detail = true,
  columns,
  className,
}: Props) => (
  <Root
    className={className}
    data-detail={detail || undefined}
    data-columns={columns}
  >
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

  ${(p) => p.theme.breakpoints.up('xl')} {
    &[data-detail][data-columns='2'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &[data-detail][data-columns='3'] {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    &[data-detail][data-columns='4'] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  /* A phone lists the metrics one per row, whatever their desktop count. */
  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--ui-space-4) 0;
    padding-block: var(--ui-space-4);

    &[data-detail] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`
