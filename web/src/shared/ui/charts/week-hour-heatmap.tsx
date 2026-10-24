import { useState } from 'react'
import styled from 'styled-components'

import { sequentialColor } from './chart-palette'
import { ChartTooltip } from './chart-tooltip'

export type WeekHourCell = { weekday: number; hour: number; value: number }

type Props = {
  cells: WeekHourCell[]
  /** ISO weekdays in reading order, from the locale's first day. */
  weekdays: { weekday: number; label: string; title: string }[]
  formatHour: (hour: number) => string
  formatValue: (value: number) => string
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * When the week's work happens: one row per weekday, one column per hour,
 * darker for more. Hovering a cell names it and its value; the strongest
 * cell sets the top of the scale.
 */
export const WeekHourHeatmap = ({
  cells,
  weekdays,
  formatHour,
  formatValue,
}: Props) => {
  const [hovered, setHovered] = useState<WeekHourCell | null>(null)
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.value]))
  const max = Math.max(0, ...cells.map((c) => c.value))

  return (
    <Root onMouseLeave={() => setHovered(null)}>
      <Grid role="grid">
        {weekdays.map((day) => (
          <Row key={day.weekday} role="row">
            <DayLabel role="rowheader" title={day.title}>
              {day.label}
            </DayLabel>
            {HOURS.map((hour) => {
              const value = byKey.get(`${day.weekday}:${hour}`) ?? 0
              const active =
                hovered?.weekday === day.weekday && hovered.hour === hour

              return (
                <Cell
                  key={hour}
                  role="gridcell"
                  aria-label={`${day.title} ${formatHour(hour)}: ${formatValue(value)}`}
                  data-active={active || undefined}
                  style={{
                    background: sequentialColor(max > 0 ? value / max : 0),
                  }}
                  onMouseEnter={() =>
                    setHovered({ weekday: day.weekday, hour, value })
                  }
                />
              )
            })}
          </Row>
        ))}
        <Row aria-hidden>
          <DayLabel />
          {HOURS.map((hour) => (
            <HourLabel key={hour}>
              {hour % 6 === 0 ? formatHour(hour) : ''}
            </HourLabel>
          ))}
        </Row>
      </Grid>
      {hovered ? (
        <Floating>
          <ChartTooltip
            title={`${
              weekdays.find((d) => d.weekday === hovered.weekday)?.title ?? ''
            }, ${formatHour(hovered.hour)}`}
            rows={[]}
            total={{ label: '', value: formatValue(hovered.value) }}
          />
        </Floating>
      ) : null}
    </Root>
  )
}

const Root = styled.div`
  position: relative;
`

const Grid = styled.div`
  display: grid;
  gap: 3px;
`

const Row = styled.div`
  display: grid;
  grid-template-columns: 32px repeat(24, minmax(0, 1fr));
  gap: 3px;
  align-items: center;
`

const DayLabel = styled.span`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
`

const Cell = styled.span`
  aspect-ratio: 1;
  min-height: 8px;
  border-radius: 3px;

  &[data-active] {
    outline: 2px solid var(--ds-neutral-12);
    outline-offset: 1px;
  }
`

const HourLabel = styled.span`
  overflow: visible;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  white-space: nowrap;
`

const Floating = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
`
