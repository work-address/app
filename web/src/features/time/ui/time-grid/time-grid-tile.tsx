import { Badge } from '@radix-ui/themes'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { getTimeActivityPercent, getTimeActivityTone } from '../../model'
import { TimeContext } from '../time-context'

import { TimeGridTileActivity } from './time-grid-tile-activity'

import type { Time } from '@/entities/time'

import { Checkbox, toImageDataUrl, Tooltip } from '@/shared'

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
    const range = `${timeFormatter.format(new Date(entry.fromAt))} - ${timeFormatter.format(new Date(entry.toAt))}`

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
          <Status>{t('dashboard.worklogsTable.paymentStatus.paid')}</Status>
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
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--white);
  overflow: hidden;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;

  &:hover,
  &:focus-within {
    border-color: var(--ds-accent-9);
    box-shadow: var(--shadow-4);
  }

  &[data-selected] {
    border-color: var(--ds-accent-9);
    box-shadow: 0 0 0 1px var(--ds-accent-9);
  }
`

const Media = styled.div`
  display: grid;
  aspect-ratio: 16 / 10;
  background: var(--ds-neutral-2);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
  overflow: hidden;

  /* One column on a phone, so a tile is as wide as the screen and a 16:10
     placeholder with nothing in it is most of the viewport. Tiles with no
     screenshot keep a short band instead; the ones with a screenshot keep
     their shape. */
  ${(p) => p.theme.breakpoints.down('md')} {
    ${Root}[data-empty] & {
      aspect-ratio: auto;
      min-height: 56px;
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
  place-self: center;
  padding: var(--space-2);
  text-align: center;
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
`

const Body = styled.div`
  display: grid;
  grid-auto-rows: min-content;
  gap: var(--space-1);
  padding: var(--space-3);
`

const Range = styled.span`
  display: block;
  font-size: var(--font-size-2);
  font-weight: 500;
  color: var(--ds-neutral-12);
`

const Project = styled.span`
  display: block;
  font-size: var(--font-size-1);
  color: var(--ds-neutral-12);
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
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Trigger = styled.button`
  position: absolute;
  inset: 0;
  z-index: 1;
`

const Selection = styled.div`
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: 2;
  display: grid;
  place-items: center;
  padding: var(--space-1);
  border-radius: var(--radius-1);
  background: var(--white);
  box-shadow: 0 0 0 1px var(--ds-neutral-alpha-6);
  opacity: 0;
  transition: opacity 0.15s;

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

const Status = styled(Badge).attrs({ color: 'green' })`
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 2;
`
