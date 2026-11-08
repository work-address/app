import { memo, useContext } from 'react'
import styled from 'styled-components'

import { formatTrackedCount, getTimeActivityPercent } from '../../model'
import { TimeContext } from '../time-context'

import { TimePaidBadge } from './time-paid-badge'
import { TimeScreenshotThumb } from './time-screenshot-thumb'

import type { Time } from '@/entities/time'

import { Checkbox, formatDurationFromMinutes } from '@/shared'

type Props = {
  entry: Time
  selected: boolean
  onOpen: (entry: Time) => void
  onSelectedChange: (id: string) => void
}

/**
 * One entry of the phone list: every fact the table shows, in reading order
 * rather than as labelled cells, with the screenshot beside it. A figure the
 * tracker never recorded is left out instead of reading as a row of dashes.
 */
export const TimeTableStackRow = memo(
  ({ entry, selected, onOpen, onSelectedChange }: Props) => {
    const { dateFormatter, timeFormatter, numberFormatter, datesGrouped, t } =
      useContext(TimeContext)

    const range = `${timeFormatter.format(new Date(entry.fromAt))} – ${timeFormatter.format(new Date(entry.toAt))}`
    const hasInput =
      entry.keyboardKeys != null ||
      entry.mouseKeys != null ||
      entry.mouseDistance != null

    return (
      <Root data-selected={selected || undefined}>
        <Selection>
          <Checkbox
            checked={selected}
            aria-label={t('dashboard.worklogsGrid.selectEntry', { range })}
            onCheckedChange={() => entry.id && onSelectedChange(entry.id)}
          />
        </Selection>
        <Body>
          <Range>{range}</Range>
          <Meta>
            <Project>{entry.project?.title ?? '—'}</Project>
            {/* Under a day heading the date is already said. */}
            {datesGrouped
              ? null
              : ` · ${dateFormatter.format(new Date(entry.fromAt))}`}
          </Meta>
          <Figures>
            <Strong>{formatDurationFromMinutes(entry.minutesActive, t)}</Strong>
            {' · '}
            {t('dashboard.worklogsGrid.activity', {
              percent: getTimeActivityPercent(entry),
            })}
          </Figures>
          {hasInput ? (
            <>
              <Figures>
                {t('dashboard.insights.inputValue', {
                  keys: formatTrackedCount(entry.keyboardKeys, numberFormatter),
                  clicks: formatTrackedCount(entry.mouseKeys, numberFormatter),
                })}
              </Figures>
              <Figures>
                {t('dashboard.worklogsTable.head.mouseDistance')}{' '}
                {formatTrackedCount(entry.mouseDistance, numberFormatter)}
              </Figures>
            </>
          ) : null}
          {entry.note ? <Note>{entry.note}</Note> : null}
        </Body>
        {/* The screenshot and the payment toggle share the trailing column,
            so the facts beside them keep the row short. */}
        <Aside>
          <TimeScreenshotThumb
            screenshot={entry.screenshot}
            alt={entry.project?.title || ''}
          />
          <TimePaidBadge entry={entry} />
        </Aside>
        {/* A stretched button rather than a clickable row: the checkbox and
            the payment toggle stay separate controls above it. */}
        <Trigger
          type="button"
          aria-label={t('dashboard.worklogsGrid.openEntry', { range })}
          onClick={() => onOpen(entry)}
        />
      </Root>
    )
  },
)

TimeTableStackRow.displayName = 'TimeTableStackRow'

const Root = styled.article`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ui-space-3);
  padding-block: var(--ui-space-3);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
  transition: background var(--ui-transition);

  &:last-child {
    border-bottom: 0;
  }

  &[data-selected] {
    background: var(--ui-inset);
  }

  &:focus-within {
    background: var(--ui-inset);
  }
`

const Selection = styled.div`
  position: relative;
  z-index: var(--ui-layer-foreground);
  display: grid;
  padding-top: var(--ui-space-1);
`

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Range = styled.span`
  color: var(--ui-ink);
  white-space: nowrap;
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const Project = styled.span`
  color: var(--ui-text);
  font-weight: var(--ui-weight-medium);
`

const Figures = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

const Strong = styled.span`
  color: var(--ui-ink);
  font-weight: var(--ui-weight-semibold);
`

const Note = styled.p`
  margin: 0;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  /* Opening the entry shows the whole note. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`

const Aside = styled.div`
  display: grid;
  justify-items: end;
  gap: var(--ui-space-2);
  padding-top: var(--ui-space-1);
`

const Trigger = styled.button`
  position: absolute;
  inset: 0;
  border-radius: var(--ui-row-radius);

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: calc(-1 * var(--ui-focus-width));
  }
`
