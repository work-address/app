import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ReactNode } from 'react'

export type StatTileTone = 'neutral' | 'accent' | 'green' | 'amber'

export type StatTileProps = {
  label: ReactNode
  value: ReactNode
  /** One line under the value that says what it is measured against. */
  hint?: ReactNode
  tone?: StatTileTone
  loading?: boolean
  className?: string
}

/**
 * One headline figure with its label - the unit a summary strip is built from.
 *
 * The value is the only thing at display size; label and hint stay small so a
 * row of four still reads as one glance rather than four paragraphs. The tone
 * is a thin colour cue on the value only, so a tinted figure never competes
 * with the badges and buttons around it.
 */
export const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral',
  loading = false,
  className,
}: StatTileProps) => (
  <Root className={className} data-tone={tone}>
    <Label>{label}</Label>
    <Skeleton loading={loading}>
      <Value>{value}</Value>
    </Skeleton>
    {hint ? (
      <Skeleton loading={loading}>
        <Hint>{hint}</Hint>
      </Skeleton>
    ) : null}
  </Root>
)

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  min-width: 0;
  padding: var(--ui-space-3) var(--ui-space-4);
  border: var(--ui-border-width) solid var(--ui-line);
  border-radius: var(--ui-control-radius);
  background: var(--ui-surface);

  &[data-tone='accent'] {
    --stat-tile-color: var(--ui-blue);
  }

  &[data-tone='green'] {
    --stat-tile-color: var(--green-11);
  }

  &[data-tone='amber'] {
    --stat-tile-color: var(--amber-11);
  }
`

const Label = styled.div`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

/* One line on a desktop, where four tiles share the row; free to wrap on a
   phone, where "211 hr 6 min covered b…" would say nothing. */
const Hint = styled.div`
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${(p) => p.theme.breakpoints.down('md')} {
    white-space: normal;
  }
`

const Value = styled.div`
  font-size: var(--stat-tile-size, var(--ui-metric-min-size));
  font-weight: var(--ui-metric-weight);
  line-height: var(--ui-metric-line-height);
  letter-spacing: var(--ui-metric-tracking);
  font-variant-numeric: tabular-nums;
  color: var(--stat-tile-color, var(--ui-ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--stat-tile-size, var(--ui-figure-size));
  }
`

/** A responsive strip of tiles: four across on a desktop, two on a phone. */
export const StatStrip = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$columns ?? 4}, minmax(0, 1fr));
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-2);

    /* An odd tile at the end takes the whole row rather than leaving a gap. */
    & > :last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
`
