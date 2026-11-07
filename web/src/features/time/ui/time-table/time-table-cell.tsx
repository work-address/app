import { Badge } from '@radix-ui/themes'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { formatTrackedCount } from '../../model'
import { TimeContext } from '../time-context'

import { TimePaidBadge } from './time-paid-badge'
import { TimeScreenshotThumb } from './time-screenshot-thumb'

import type { Time } from '@/entities/time'

import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Tooltip,
} from '@/shared'

export const TimeTableCell = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, numberFormatter, t } =
    useContext(TimeContext)

  switch (props.dataKey) {
    case 'note': {
      const note = props.data.note

      if (!note) {
        return <Muted>—</Muted>
      }

      return (
        <Tooltip content={note}>
          {/* Radix needs a ref-able element to anchor the tooltip, and the
              ellipsis has to sit on whatever directly holds the text - an
              inner atomic inline would be clipped without the dots. */}
          <NoteAnchor>
            <Note>{note}</Note>
          </NoteAnchor>
        </Tooltip>
      )
    }

    case 'screenshot': {
      return (
        <TimeScreenshotThumb
          screenshot={props.data.screenshot}
          alt={props.data.project?.title || ''}
        />
      )
    }

    case 'fromAt': {
      return (
        <Stack>
          <Primary>
            {timeFormatter.format(new Date(props.data.fromAt))} –{' '}
            {timeFormatter.format(new Date(props.data.toAt))}
          </Primary>
          <Meta>{dateFormatter.format(new Date(props.data.fromAt))}</Meta>
        </Stack>
      )
    }

    case 'keyboardKeys':
    case 'mouseKeys':
    case 'mouseDistance': {
      return (
        <Figure>
          {formatTrackedCount(props.data[props.dataKey], numberFormatter)}
        </Figure>
      )
    }

    case 'minutesActive': {
      return (
        <Badge
          size="2"
          radius="full"
          color={getTimeActiveColor(props.data.minutesActive)}
        >
          {formatDurationFromMinutes(props.data.minutesActive, t)}
        </Badge>
      )
    }

    default: {
      if (props.customKey === 'paidStatus') {
        return <TimePaidBadge entry={props.data} />
      }

      if (props.customKey === 'projectName') {
        return <Name>{props.data.project?.title ?? '—'}</Name>
      }

      return (
        <Figure>
          <props.DefaultBodyComponent {...props} />
        </Figure>
      )
    }
  }
})

const Stack = styled.span`
  display: grid;
  min-width: 0;
`

const Primary = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Name = styled.span`
  min-width: 0;
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  overflow-wrap: anywhere;
`

const Figure = styled.span`
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Muted = styled.span`
  color: var(--ui-muted);
`

const NoteAnchor = styled.span`
  display: block;
  /* Flex items refuse to shrink past their content without this, which would
     hand the note back the width the truncated column just took away. */
  min-width: 0;
  max-width: 100%;
`

const Note = styled.span`
  display: block;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
