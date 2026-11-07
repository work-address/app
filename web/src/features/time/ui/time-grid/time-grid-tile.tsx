import { ImageIcon } from '@radix-ui/react-icons'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { getTimeActivityPercent, getTimeActivityTone } from '../../model'
import { TimeContext } from '../time-context'

import { TimeGridTileActivity } from './time-grid-tile-activity'

import type { Time } from '@/entities/time'

import { Checkbox, toImageDataUrl, Tooltip, WorkspaceStatus } from '@/shared'

type Props = {
  entry: Time
  selected: boolean
  onOpen: (entry: Time) => void
  onSelectedChange: (id: string) => void
}

export const TimeGridTile = memo(
  ({ entry, selected, onOpen, onSelectedChange }: Props) => {
    const { timeFormatter, t } = useContext(TimeContext)

    const percent = getTimeActivityPercent(entry)
    const tone = getTimeActivityTone(percent)
    const screenshotSrc = toImageDataUrl(entry.screenshot)
    const range = `${timeFormatter.format(new Date(entry.fromAt))} – ${timeFormatter.format(new Date(entry.toAt))}`

    return (
      <Root
        data-tone={tone}
        data-selected={selected || undefined}
        data-empty={!screenshotSrc || undefined}
      >
        <Media>
          {screenshotSrc ? (
            <Thumb src={screenshotSrc} alt={range} loading="lazy" />
          ) : (
            <Placeholder>
              <ImageIcon aria-hidden />
              {t('dashboard.worklogsTable.screenshotNoData')}
            </Placeholder>
          )}
        </Media>
        <Body>
          <Range>{range}</Range>
          <TimeGridTileActivity
            percent={percent}
            tone={tone}
            label={t('dashboard.worklogsGrid.activity', { percent })}
          />
          <Project>{entry.project?.title ?? '—'}</Project>
          <Tooltip content={entry.note || t('dashboard.worklogsGrid.noNote')}>
            <NoteAnchor>
              <Note>{entry.note || '—'}</Note>
            </NoteAnchor>
          </Tooltip>
        </Body>
        {/* A stretched button rather than a clickable Root: it keeps the
            checkbox from being an interactive descendant of the open control,
            while still giving the whole tile one keyboard-reachable target. */}
        <Trigger
          type="button"
          aria-label={t('dashboard.worklogsGrid.openEntry', { range })}
          onClick={() => onOpen(entry)}
        />
        <Selection>
          <Checkbox
            checked={selected}
            aria-label={t('dashboard.worklogsGrid.selectEntry', { range })}
            onCheckedChange={() => entry.id && onSelectedChange(entry.id)}
          />
        </Selection>
        {entry.isPaid && (
          <Status tone="positive">
            {t('dashboard.worklogsTable.paymentStatus.paid')}
          </Status>
        )}
      </Root>
    )
  },
)

TimeGridTile.displayName = 'TimeGridTile'

const Root = styled.article`
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr;
  border: var(--ui-border-width) solid var(--ui-line);
  border-radius: var(--ui-control-radius);
  background: var(--ui-surface);
  overflow: hidden;
  transition:
    box-shadow var(--ui-transition),
    border-color var(--ui-transition);

  &:hover,
  &:focus-within {
    border-color: var(--ui-blue);
    box-shadow: var(--ui-shadow);
  }

  &[data-selected] {
    border-color: var(--ui-blue);
    box-shadow: 0 0 0 var(--ui-border-width) var(--ui-blue);
  }
`

const Media = styled.div`
  display: grid;
  aspect-ratio: 16 / 10;
  background: var(--ui-inset);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
  overflow: hidden;

  /* A phone tile with nothing to show keeps a short band instead of a
     16:10 frame of empty space; those with a screenshot keep their shape. */
  ${(p) => p.theme.breakpoints.down('md')} {
    ${Root}[data-empty] & {
      aspect-ratio: auto;
      min-height: var(--ui-space-9);
    }
  }
`

const Thumb = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
`

const Placeholder = styled.span`
  display: grid;
  grid-auto-flow: column;
  place-self: center;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  text-align: center;
`

const Body = styled.div`
  display: grid;
  grid-auto-rows: min-content;
  gap: var(--ui-space-1);
  padding: var(--ui-space-3);
`

const Range = styled.span`
  display: block;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
`

const Project = styled.span`
  display: block;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const NoteAnchor = styled.span`
  display: block;
  min-width: 0;
  /* Above the stretched trigger, or the tooltip never sees the pointer. */
  position: relative;
  z-index: 2;
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

const Trigger = styled.button`
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: calc(-1 * var(--ui-focus-width));
  }
`

const Selection = styled.div`
  position: absolute;
  top: var(--ui-space-2);
  left: var(--ui-space-2);
  z-index: 2;
  display: grid;
  place-items: center;
  padding: var(--ui-space-1);
  border-radius: var(--ui-row-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);
  opacity: 0;
  transition: opacity var(--ui-transition);

  ${Root}:hover &,
  ${Root}:focus-within &,
  ${Root}[data-selected] & {
    opacity: 1;
  }

  /* Pointer capability, not viewport width: without hover there is no way to
     reveal the checkbox, so it stays out. */
  @media (hover: none) {
    opacity: 1;
  }
`

/* Over the screenshot, so its translucent tint sits on the surface. */
const Status = styled(WorkspaceStatus)`
  background: linear-gradient(
      var(--status-background),
      var(--status-background)
    )
    var(--ui-surface);
  box-shadow: var(--ui-shadow);
  position: absolute;
  top: var(--ui-space-2);
  right: var(--ui-space-2);
  z-index: 2;
`
