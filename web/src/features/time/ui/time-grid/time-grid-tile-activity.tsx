import styled from 'styled-components'

import type { TimeActivityTone } from '../../model'
import type { CSSProperties } from 'react'

type Props = {
  percent: number
  tone: TimeActivityTone
  label: string
  className?: string
}

export const TimeGridTileActivity = ({
  percent,
  tone,
  label,
  className,
}: Props) => {
  return (
    <Root className={className} data-tone={tone}>
      <Track
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        // Measured per render, so it cannot be a static declaration.
        style={{ '--activity-fill': `${percent}%` } as CSSProperties}
      >
        <Fill />
      </Track>
      <Value>{percent}%</Value>
    </Root>
  )
}

const Root = styled.div`
  --activity-color: var(--ds-neutral-11);

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2);

  &[data-tone='low'] {
    --activity-color: var(--red-9);
  }

  &[data-tone='medium'] {
    --activity-color: var(--orange-9);
  }

  &[data-tone='high'] {
    --activity-color: var(--green-9);
  }
`

const Track = styled.div`
  display: grid;
  grid-template-columns: var(--activity-fill) 1fr;
  height: 4px;
  border-radius: var(--radius-1);
  background: var(--ds-neutral-alpha-3);
  overflow: hidden;
`

const Fill = styled.div`
  background: var(--activity-color);
`

const Value = styled.span`
  font-size: var(--font-size-0);
  font-variant-numeric: tabular-nums;
  color: var(--activity-color);
`
