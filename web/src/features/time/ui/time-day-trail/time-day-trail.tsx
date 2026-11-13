import { SewingPinIcon } from '@radix-ui/react-icons'
import { addDays } from 'date-fns'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { TimeDayGroup } from '../../model'
import type { Time } from '@/entities/time'

import { timeTrailQuery } from '@/entities/time'
import {
  AdaptiveDialog,
  Button,
  formatAddress,
  hasFix,
  Select,
  Text,
  TrailMap,
  type TrailPoint,
} from '@/shared'

type Person = { id: string; label: string }

const personOf = (entry: Time): Person | null =>
  entry.user?.id
    ? {
        id: entry.user.id,
        label: entry.user.name || formatAddress(entry.user.address ?? ''),
      }
    : null

/**
 * The people whose phone left a trail among a day's loaded entries, in the
 * order they first appear.
 */
const peopleWithTrail = (entries: Time[]): Person[] => {
  const people = new Map<string, Person>()
  for (const entry of entries) {
    const person = personOf(entry)
    if (person && hasFix(entry.locations) && !people.has(person.id)) {
      people.set(person.id, person)
    }
  }
  return [...people.values()]
}

/**
 * "Trail" beside a day's heading, where any of its phone entries has a fix:
 * opens one person's day on a map, read whole from the server.
 */
export const TimeDayTrail = ({ group }: { group: TimeDayGroup }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const people = useMemo(() => peopleWithTrail(group.entries), [group.entries])

  if (people.length === 0) {
    return null
  }

  return (
    <>
      <Button
        size="s"
        variant="ghost"
        color="neutral"
        onClick={() => setOpen(true)}
      >
        <SewingPinIcon width={12} height={12} aria-hidden />
        {t('time.trail.open')}
      </Button>
      {open && (
        <TimeDayTrailDialog
          day={group.date}
          people={people}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

const TimeDayTrailDialog = ({
  day,
  people,
  onClose,
}: {
  day: Date
  people: Person[]
  onClose: () => void
}) => {
  const { t, i18n } = useTranslation()
  const [personId, setPersonId] = useState(people[0].id)
  const { start, reset, data, pending, failed } = useUnit({
    start: timeTrailQuery.start,
    reset: timeTrailQuery.reset,
    data: timeTrailQuery.$data,
    pending: timeTrailQuery.$pending,
    failed: timeTrailQuery.$failed,
  })

  useEffect(() => {
    start({
      userId: personId,
      fromAt: day.toISOString(),
      toAt: addDays(day, 1).toISOString(),
    })
  }, [start, personId, day])

  // The next trail opened must not show this one while it loads.
  useEffect(() => reset, [reset])

  const formatTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return (at: string) => formatter.format(new Date(at))
  }, [i18n.language])

  const entries = data ?? []
  const points = useMemo(
    () => (data ?? []).flatMap((entry): TrailPoint[] => entry.locations ?? []),
    [data],
  )
  const underReview = entries.some((entry) => entry.detailPendingReview)
  const person = people.find(({ id }) => id === personId) ?? people[0]
  const dayLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(day)

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('time.trail.title')}
      desktopWidth="720px"
      desktopShowClose
    >
      <Body>
        <Text size="2" color="gray">
          {dayLabel}
        </Text>
        {people.length > 1 && (
          <Select
            label={t('time.trail.person')}
            options={people.map(({ id, label }) => ({ value: id, label }))}
            value={personId}
            onChange={(value) => {
              if (!Array.isArray(value)) {
                setPersonId(value)
              }
            }}
          />
        )}
        {pending && !data ? (
          <MapSpace />
        ) : failed ? (
          <Text size="2" color="gray">
            {t('time.trail.failed')}
          </Text>
        ) : hasFix(points) ? (
          <TrailMap
            points={points}
            label={t('time.trail.mapLabel', {
              person: person.label,
              day: dayLabel,
            })}
            fakedLabel={t('time.location.faked')}
            formatTime={formatTime}
            height={420}
          />
        ) : (
          <Text size="2" color="gray">
            {t('time.trail.empty')}
          </Text>
        )}
        {underReview && (
          <Text size="2" color="gray">
            {t('time.trail.underReview')}
          </Text>
        )}
      </Body>
    </AdaptiveDialog>
  )
}

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-3);
  min-width: 0;
`

const MapSpace = styled.div`
  height: 420px;
  border-radius: 12px;
  background: var(--ui-inset);
`
