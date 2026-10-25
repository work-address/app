import { useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import { sequentialColor } from './chart-palette'
import { ChartTooltip, type ChartTooltipContent } from './chart-tooltip'

import type { MouseEvent } from 'react'

export type WeekHourCell = { weekday: number; hour: number; value: number }

export type WeekHourPopup = ChartTooltipContent

type Props = {
  cells: WeekHourCell[]
  /** ISO weekdays in reading order, from the locale's first day. */
  weekdays: { weekday: number; label: string; title: string }[]
  formatHour: (hour: number) => string
  /** The value alone, for the cell's accessible name. */
  formatValue: (value: number) => string
  /** What the popup says about a cell, beyond its day and hour. */
  describe: (cell: WeekHourCell) => WeekHourPopup
}

type Hovered = WeekHourCell & {
  /** The cell's centre, and its top and bottom, inside the heatmap. */
  x: number
  top: number
  bottom: number
  /** Which side of the cell the popup opens on. */
  side: 'above' | 'below'
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Rows at the bottom that open their popup above, over the heatmap. */
const ROWS_OPENING_ABOVE = 2

/**
 * Below the hovered row, over the card's own figures, so a tall breakdown
 * never covers the section above the card; the last rows open above, over
 * the heatmap, so it never runs out of the card at the bottom either.
 */
export const weekHourPopupSide = (
  rowIndex: number,
  rowCount: number,
): Hovered['side'] =>
  rowIndex >= rowCount - ROWS_OPENING_ABOVE ? 'above' : 'below'

/**
 * The popup's left edge: centred on the cell, then slid back inside the
 * heatmap so a cell near either edge never pushes it out of the card.
 */
export const clampPopupLeft = (x: number, width: number, available: number) =>
  Math.max(0, Math.min(x - width / 2, available - width))

/**
 * When the week's work happens: one row per weekday, one column per hour,
 * darker for more. Hovering a cell opens a popup beside it with what the
 * caller says about it; the strongest cell sets the top of the scale.
 */
export const WeekHourHeatmap = ({
  cells,
  weekdays,
  formatHour,
  formatValue,
  describe,
}: Props) => {
  const [hovered, setHovered] = useState<Hovered | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // The popup's width is only known once drawn: measure it before paint and
  // clamp it inside the heatmap, so it never shows in the wrong place first.
  useLayoutEffect(() => {
    if (!hovered || !popupRef.current || !rootRef.current) {
      return
    }
    setLeft(
      clampPopupLeft(
        hovered.x,
        popupRef.current.offsetWidth,
        rootRef.current.offsetWidth,
      ),
    )
  }, [hovered])
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.value]))
  const max = Math.max(0, ...cells.map((c) => c.value))

  const hover = (
    event: MouseEvent<HTMLElement>,
    cell: WeekHourCell,
    rowIndex: number,
  ) => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const box = root.getBoundingClientRect()
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2 - box.left

    setHovered({
      ...cell,
      x,
      top: rect.top - box.top,
      bottom: rect.bottom - box.top,
      side: weekHourPopupSide(rowIndex, weekdays.length),
    })
  }

  const detail = hovered ? describe(hovered) : null

  return (
    <Root
      ref={rootRef}
      data-heatmap
      onMouseLeave={() => {
        setHovered(null)
        setLeft(null)
      }}
    >
      <Grid role="grid">
        {weekdays.map((day, rowIndex) => (
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
                  onMouseEnter={(event) =>
                    hover(
                      event,
                      { weekday: day.weekday, hour, value },
                      rowIndex,
                    )
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
      {hovered && detail ? (
        <Popup
          ref={popupRef}
          data-side={hovered.side}
          data-measured={left !== null || undefined}
          data-wide={
            detail.sections?.some((section) => section.rows.length > 0) ||
            undefined
          }
          style={{
            left: left ?? 0,
            top: hovered.side === 'below' ? hovered.bottom : hovered.top,
          }}
        >
          <ChartTooltip
            title={
              detail.title ??
              `${
                weekdays.find((d) => d.weekday === hovered.weekday)?.title ?? ''
              }, ${formatHour(hovered.hour)}`
            }
            rows={detail.rows}
            sections={detail.sections}
            note={detail.note}
            layout="horizontal"
          />
        </Popup>
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

/* Anchored to the hovered cell: its top comes from the cell, its left is
   measured and clamped, and data-side decides which way it grows. Hidden
   until measured, so it never flashes at the edge. */
const Popup = styled.div`
  --popup-gap: 8px;

  position: absolute;
  z-index: 1;
  width: max-content;
  max-width: 100%;
  visibility: hidden;
  pointer-events: none;

  &[data-measured] {
    visibility: visible;
  }

  /* A breakdown is laid out in columns, which need a width to sit side by
     side in; the heatmap's width caps it and the columns wrap below that. */
  &[data-wide] {
    width: min(640px, 100%);
  }

  &[data-side='above'] {
    translate: 0 calc(-100% - var(--popup-gap));
  }

  &[data-side='below'] {
    translate: 0 var(--popup-gap);
  }
`
