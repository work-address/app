import { useUnit } from 'effector-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $mapEntryId,
  getTimeLocations,
  mapEntryClosed,
  mapEntryOpened,
} from '../../model'
import { TimeDialog } from '../time-dialog/time-dialog'

import type { Time } from '@/entities/time'

import { TrailMap, type TrailPoint } from '@/shared'

type Props = { entries: Time[] }

/**
 * Where the phones were, over the entries given: one line per person per day.
 * A point opens its entry's dialog in place, with the entries before and after
 * it on the map a step away.
 */
export const TimeLocationsMap = ({ entries }: Props) => {
  const { t, i18n } = useTranslation()
  const { openId, open, close } = useUnit({
    openId: $mapEntryId,
    open: mapEntryOpened,
    close: mapEntryClosed,
  })
  const located = useMemo(() => getTimeLocations(entries), [entries])

  const formatTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
    return (at: string) => formatter.format(new Date(at))
  }, [i18n.language])

  const onFixClick = useCallback(
    (point: TrailPoint) => {
      const id = located.entryOf.get(point)?.id
      if (id) {
        open(id)
      }
    },
    [located, open],
  )

  const index = located.entries.findIndex((entry) => entry.id === openId)
  const selected = index === -1 ? null : located.entries[index]!
  const step = (by: number) => {
    const id = located.entries[index + by]?.id

    if (id) {
      open(id)
    }
  }

  // The open entry has left the map, or the map itself is going away.
  useEffect(() => {
    if (openId !== null && selected === null) {
      close()
    }
  }, [openId, selected, close])
  useEffect(() => close, [close])

  return (
    <>
      <TrailMap
        trails={located.trails}
        label={t('dashboard.locations.mapLabel')}
        fakedLabel={t('time.location.faked')}
        formatTime={formatTime}
        height={360}
        onFixClick={onFixClick}
      />
      <TimeDialog
        open={selected !== null}
        row={selected}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            close()
          }
        }}
        hasPrev={index > 0}
        hasNext={index !== -1 && index < located.entries.length - 1}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </>
  )
}
