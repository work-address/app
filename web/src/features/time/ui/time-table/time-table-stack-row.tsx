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

/** One entry of the phone list, with every column of the table, labelled. */
export const TimeTableStackRow = memo(
  ({ entry, selected, onOpen, onSelectedChange }: Props) => {
    const { dateFormatter, timeFormatter, numberFormatter, t } =
      useContext(TimeContext)

    const range = `${timeFormatter.format(new Date(entry.fromAt))} – ${timeFormatter.format(new Date(entry.toAt))}`

    const figures = [
      {
        key: 'keyboard',
        label: t('dashboard.worklogsTable.head.keyboard'),
        value: formatTrackedCount(entry.keyboardKeys, numberFormatter),
      },
      {
        key: 'mouse',
        label: t('dashboard.worklogsTable.head.mouse'),
        value: formatTrackedCount(entry.mouseKeys, numberFormatter),
      },
      {
        key: 'mouseDistance',
        label: t('dashboard.worklogsTable.head.mouseDistance'),
        value: formatTrackedCount(entry.mouseDistance, numberFormatter),
      },
    ]

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
            {' · '}
            {dateFormatter.format(new Date(entry.fromAt))}
          </Meta>
          {entry.note ? <Note>{entry.note}</Note> : null}
          <Details>
            <Detail>
              <Label>{t('dashboard.worklogsTable.head.paymentStatus')}</Label>
              <Value>
                <TimePaidBadge entry={entry} />
              </Value>
            </Detail>
            <Detail>
              <Label>{t('dashboard.worklogsTable.head.timeActive')}</Label>
              <Value>
                {formatDurationFromMinutes(entry.minutesActive, t)} ·{' '}
                {t('dashboard.worklogsGrid.activity', {
                  percent: getTimeActivityPercent(entry),
                })}
              </Value>
            </Detail>
            {figures.map((figure) => (
              <Detail key={figure.key}>
                <Label>{figure.label}</Label>
                <Value>{figure.value}</Value>
              </Detail>
            ))}
            <Detail>
              <Label>{t('dashboard.worklogsTable.head.screenshot')}</Label>
              <Value>
                <TimeScreenshotThumb
                  screenshot={entry.screenshot}
                  alt={entry.project?.title || ''}
                />
              </Value>
            </Detail>
          </Details>
        </Body>
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
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-space-3);
  padding-block: var(--ui-space-4);
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

const Details = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-2) var(--ui-space-3);
  margin: var(--ui-space-2) 0 0;
`

const Detail = styled.div`
  display: grid;
  justify-items: start;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Label = styled.dt`
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

const Value = styled.dd`
  margin: 0;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
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
