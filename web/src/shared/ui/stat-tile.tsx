import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

import { Text } from './text'

import type { ReactNode } from 'react'

export type StatTileTone = 'neutral' | 'accent' | 'green' | 'amber'

export type StatTileProps = {
  label: string
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
    <Text size="2" color="gray" as="div">
      {label}
    </Text>
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
  gap: 2px;
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--color-panel-solid);

  &[data-tone='accent'] {
    --stat-tile-color: var(--ds-accent-11);
  }

  &[data-tone='green'] {
    --stat-tile-color: var(--green-11);
  }

  &[data-tone='amber'] {
    --stat-tile-color: var(--amber-11);
  }
`

/* One line on a desktop, where four tiles share the row; free to wrap on a
   phone, where "211 hr 6 min covered b…" would say nothing. */
const Hint = styled.div`
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
  color: var(--ds-neutral-11);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${(p) => p.theme.breakpoints.down('md')} {
    white-space: normal;
  }
`

const Value = styled.div`
  font-size: var(--font-size-6);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--stat-tile-color, var(--ds-neutral-12));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-5);
  }
`

/** A responsive strip of tiles: four across on a desktop, two on a phone. */
export const StatStrip = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$columns ?? 4}, minmax(0, 1fr));
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);

    /* An odd tile at the end takes the whole row rather than leaving a gap. */
    & > :last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
`
