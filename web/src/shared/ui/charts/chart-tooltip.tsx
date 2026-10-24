import styled from 'styled-components'

import type { ReactNode } from 'react'

export type ChartTooltipRow = {
  label: string
  value: string
  color?: string
}

type Props = {
  title: ReactNode
  rows: ChartTooltipRow[]
  total?: { label: string; value: string }
  empty?: string
}

/**
 * The card every dashboard chart shows on hover: a title, one row per series
 * with its swatch, and an optional total. Values are in ink, never in the
 * series colour.
 */
export const ChartTooltip = ({ title, rows, total, empty }: Props) => (
  <Root role="tooltip">
    <Title>{title}</Title>
    {rows.length === 0 && empty ? <Muted>{empty}</Muted> : null}
    {rows.length > 0 && (
      <List>
        {rows.map((row) => (
          <Row key={row.label}>
            <Label>
              {row.color ? <Swatch style={{ background: row.color }} /> : null}
              {row.label}
            </Label>
            <Value>{row.value}</Value>
          </Row>
        ))}
      </List>
    )}
    {total ? (
      <Total>
        <Muted>{total.label}</Muted>
        <Value>{total.value}</Value>
      </Total>
    ) : null}
  </Root>
)

const Root = styled.div`
  min-width: 180px;
  max-width: 320px;
  padding: 8px 10px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: 10px;
  background: var(--color-panel-solid);
  box-shadow: 0 1px 6px var(--c-rgba-0-0-0-0_08);
  color: var(--ds-neutral-12);
  pointer-events: none;
`

const Title = styled.div`
  padding-bottom: 6px;
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 20px;
`

const List = styled.div`
  display: grid;
  gap: 6px;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`

const Label = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
  white-space: nowrap;
  text-overflow: ellipsis;
`

const Swatch = styled.span`
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
`

const Value = styled.span`
  flex: none;
  font-size: var(--font-size-2);
  white-space: nowrap;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const Muted = styled.span`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
`

const Total = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ds-neutral-alpha-5);
`
