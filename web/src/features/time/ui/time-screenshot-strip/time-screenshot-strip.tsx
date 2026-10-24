import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

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
  const [index, setIndex] = useState<number | null>(null)

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

  const selected = index === null ? null : (entries[index] ?? null)

  return (
    <>
      <Grid>
        {entries.map((entry, position) => {
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
              onClick={() => setIndex(position)}
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
        onOpenChange={(open) => {
          if (!open) {
            setIndex(null)
          }
        }}
        hasPrev={index !== null && index > 0}
        hasNext={index !== null && index < entries.length - 1}
        onPrev={() => setIndex((i) => (i === null ? i : Math.max(0, i - 1)))}
        onNext={() =>
          setIndex((i) =>
            i === null ? i : Math.min(entries.length - 1, i + 1),
          )
        }
      />
    </>
  )
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);

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
    border-radius: var(--radius-3);
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--ds-neutral-alpha-5);
  }

  &:hover img,
  &:focus-visible img {
    box-shadow: 0 0 0 2px var(--ds-accent-9);
  }
`

const Caption = styled.span`
  overflow: hidden;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  white-space: nowrap;
  text-overflow: ellipsis;
`
