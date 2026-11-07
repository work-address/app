import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  label: ReactNode
  value: ReactNode
  /** The unabbreviated value for assistive technology. */
  valueLabel?: string
  hint?: ReactNode
  loading: boolean
  className?: string
}

/**
 * A dt/dd group for WorkspaceSummary. Its dividers and final odd-item span
 * require that container's five-column desktop / two-column narrow layout.
 */
export const WorkspaceMetric = ({
  label,
  value,
  valueLabel,
  hint,
  loading,
  className,
}: Props) => (
  <Root className={className}>
    <Label>{label}</Label>
    <Skeleton loading={loading}>
      <Value aria-label={valueLabel}>{value}</Value>
    </Skeleton>
    {hint ? (
      <Skeleton loading={loading}>
        <Hint>{hint}</Hint>
      </Skeleton>
    ) : null}
  </Root>
)

const Root = styled.div`
  container-type: inline-size;
  display: grid;
  align-content: start;
  gap: var(--ui-space-2);
  min-width: 0;
  padding-inline: var(--ui-space-5);
  border-inline-start: var(--ui-border-width) solid var(--ui-line);

  &:first-child {
    border-inline-start: 0;
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    padding-inline: var(--ui-space-4);

    &:nth-child(odd) {
      border-inline-start: 0;
    }

    &:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }

  ${(p) => p.theme.breakpoints.down('sm')} {
    padding-inline: var(--ui-space-3);
  }
`

const Label = styled.dt`
  color: var(--ui-muted);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
`

const Value = styled.dd`
  min-width: 0;
  margin: 0;
  color: var(--ui-ink);
  /* Long localized durations remain visible when a metric has less room. */
  font-size: clamp(
    var(--ui-metric-min-size),
    var(--ui-metric-fluid-size),
    var(--ui-metric-size)
  );
  font-weight: var(--ui-metric-weight);
  line-height: var(--ui-metric-line-height);
  letter-spacing: var(--ui-metric-tracking);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  ${(p) => p.theme.breakpoints.down('md')} {
    /* The final full-width metric keeps its neighbours' hierarchy. */
    font-size: var(--ui-metric-min-size);
  }
`

const Hint = styled.dd`
  min-width: 0;
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`
