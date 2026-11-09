import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $stripEntryId, stripEntryClosed, stripEntryOpened } from '../../model'
import { TimeDialog } from '../time-dialog/time-dialog'

import type { Time } from '@/entities/time'

import { toImageDataUrl } from '@/shared'

type Props = { entries: Time[] }

/**
 * A row of recent screenshots. Each opens its entry's dialog in place, with
 * the neighbours in the strip a step away.
 */
export const TimeScreenshotStrip = ({ entries }: Props) => {
  const { i18n } = useTranslation()
  const { openId, open, close } = useUnit({
    openId: $stripEntryId,
    open: stripEntryOpened,
    close: stripEntryClosed,
  })

  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [i18n.language],
  )

  const index = entries.findIndex((entry) => entry.id === openId)
  const selected = index === -1 ? null : entries[index]!
  const step = (by: number) => {
    const id = entries[index + by]?.id

    if (id) {
      open(id)
    }
  }

  // The open entry has left the strip, or the strip itself is going away.
  useEffect(() => {
    if (openId !== null && selected === null) {
      close()
    }
  }, [openId, selected, close])
  useEffect(() => close, [close])

  return (
    <>
      <Grid>
        {entries.map((entry) => {
          const src = toImageDataUrl(entry.screenshot)
          const label = `${entry.project?.title ?? ''} · ${when.format(
            new Date(entry.fromAt),
          )}`

          return src ? (
            <Thumb
              key={entry.id}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => entry.id && open(entry.id)}
            >
              <img src={src} alt="" loading="lazy" />
              <Caption>{label}</Caption>
            </Thumb>
          ) : null
        })}
      </Grid>
      <TimeDialog
        open={selected !== null}
        row={selected}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            close()
          }
        }}
        hasPrev={index > 0}
        hasNext={index !== -1 && index < entries.length - 1}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </>
  )
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const Thumb = styled.button`
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;

  img {
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: var(--ui-filter-radius);
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--ui-line);
  }

  &:hover img,
  &:focus-visible img {
    box-shadow: 0 0 0 2px var(--ui-blue);
  }
`

const Caption = styled.span`
  overflow: hidden;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  white-space: nowrap;
  text-overflow: ellipsis;
`
