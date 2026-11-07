import { ArrowTopRightIcon, TextAlignLeftIcon } from '@radix-ui/react-icons'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { formatTrackedCount, getTimeActivityPercent } from '../../model'
import { TimeContext } from '../time-context'

import { TimePaidBadge } from './time-paid-badge'
import { TimeScreenshotThumb } from './time-screenshot-thumb'

import type { Time } from '@/entities/time'

import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  Tooltip,
} from '@/shared'

const NOTE_ICON_SIZE = 14

/**
 * One cell of the list. The session leads with its project, time and note;
 * the figures beside it are the entry's activity and payment.
 */
export const TimeTableCell = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, numberFormatter, t } =
    useContext(TimeContext)
  const entry = props.data

  if (props.customKey === 'paidStatus') {
    return <TimePaidBadge entry={entry} />
  }

  if (props.customKey === 'open') {
    return (
      <OpenHint>
        <ArrowTopRightIcon aria-hidden />
      </OpenHint>
    )
  }

  if (props.customKey === 'activity') {
    // Nothing recorded at all reads as one dash, not three.
    if (
      entry.keyboardKeys == null &&
      entry.mouseKeys == null &&
      entry.mouseDistance == null
    ) {
      return <Meta>—</Meta>
    }

    return (
      <Stack>
        <Figure>
          {t('dashboard.insights.inputValue', {
            keys: formatTrackedCount(entry.keyboardKeys, numberFormatter),
            clicks: formatTrackedCount(entry.mouseKeys, numberFormatter),
          })}
        </Figure>
        <Meta>
          {t('dashboard.worklogsTable.head.mouseDistance')}{' '}
          {formatTrackedCount(entry.mouseDistance, numberFormatter)}
        </Meta>
      </Stack>
    )
  }

  switch (props.dataKey) {
    case 'fromAt': {
      return (
        <Stack>
          <Name>{entry.project?.title ?? '—'}</Name>
          <Meta>
            {timeFormatter.format(new Date(entry.fromAt))} –{' '}
            {timeFormatter.format(new Date(entry.toAt))} ·{' '}
            {dateFormatter.format(new Date(entry.fromAt))}
          </Meta>
          {entry.note ? (
            <Tooltip content={entry.note}>
              {/* The ellipsis has to sit on whatever directly holds the
                  text, and Radix needs a ref-able anchor for the tooltip. */}
              <Note>
                <TextAlignLeftIcon
                  width={NOTE_ICON_SIZE}
                  height={NOTE_ICON_SIZE}
                  aria-hidden
                />
                <NoteText>{entry.note}</NoteText>
              </Note>
            </Tooltip>
          ) : null}
        </Stack>
      )
    }

    case 'minutesActive': {
      return (
        <Stack>
          <Figure data-strong>
            {formatDurationFromMinutes(entry.minutesActive, t)}
          </Figure>
          <Meta>
            {t('dashboard.worklogsGrid.activity', {
              percent: getTimeActivityPercent(entry),
            })}
          </Meta>
        </Stack>
      )
    }

    case 'screenshot': {
      return (
        <TimeScreenshotThumb
          screenshot={entry.screenshot}
          alt={entry.project?.title || ''}
        />
      )
    }

    default: {
      return (
        <Figure>
          <props.DefaultBodyComponent {...props} />
        </Figure>
      )
    }
  }
})

const OpenHint = styled.span`
  display: grid;
  color: var(--ui-muted);
`

const Stack = styled.span`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Name = styled.span`
  min-width: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  overflow-wrap: anywhere;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
`

const Figure = styled.span`
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &[data-strong] {
    color: var(--ui-ink);
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
    font-weight: var(--ui-weight-semibold);
  }
`

const Note = styled.span`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
  color: var(--ui-text);
`

const NoteText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`
