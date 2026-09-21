import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  CADENCE_WEEKDAY_KEYS,
  cadenceTimezoneOptions,
  canEditProjectCadence,
  projectCadenceConsent,
  projectCadenceLocalReading,
  projectCadenceNextCutoff,
  projectCadenceNextIssue,
  projectCadenceState,
} from '../../model'

import {
  projectCadenceQuery,
  setProjectCadenceConsentMutation,
  setProjectCadenceMutation,
} from '@/entities/projects'
import {
  Button,
  Checkbox,
  Input,
  Select,
  Text,
  useDateFormatter,
} from '@/shared'

type Props = {
  projectId: string
}

const CONSENT_ID_PREFIX = 'project-cadence-consent-'

/**
 * When this project's week closes, and whether it may invoice your hours.
 *
 * Shown to the owner and to every worker, because the cutoff is when *their*
 * hours stop being this week's. A viewer never sees it - the API refuses them
 * and the drawer draws nothing rather than an empty box.
 */
export const ProjectsDialogCadence = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const [editing, setEditing] = useState(false)

  const { view, loading, failed, start, setCadence, setConsent, saving } =
    useUnit({
      view: projectCadenceQuery.$data,
      loading: projectCadenceQuery.$pending,
      failed: projectCadenceQuery.$failed,
      start: projectCadenceQuery.start,
      setCadence: setProjectCadenceMutation.start,
      setConsent: setProjectCadenceConsentMutation.start,
      saving: setProjectCadenceMutation.$pending,
    })

  useEffect(() => {
    start(projectId)
    setEditing(false)
  }, [projectId, start])

  if (failed || (!view && !loading)) {
    return null
  }

  const state = projectCadenceState(view)
  const reading = projectCadenceLocalReading(view)
  const cutoff = projectCadenceNextCutoff(view)
  const issueAt = projectCadenceNextIssue(view)
  const consent = projectCadenceConsent(view)
  const consentId = `${CONSENT_ID_PREFIX}${projectId}`

  return (
    <Flex direction="column" gap="3" minWidth="0">
      <Text size="2" color="gray">
        {t('project.cadence.title')}
      </Text>
      {state === 'off' ? (
        <Text size="2">{t('project.cadence.off')}</Text>
      ) : (
        <Flex direction="column" gap="1" minWidth="0">
          <Text size="2" weight="medium">
            {reading?.weekdayKey
              ? t('project.cadence.rule', {
                  weekday: t(reading.weekdayKey),
                  time: reading.time,
                  timezone: view?.current?.timezone ?? '',
                })
              : ''}
          </Text>
          {cutoff && (
            <Text size="2" color="gray">
              {t('project.cadence.nextCutoff', {
                when: dateFormatter.format(cutoff),
              })}
            </Text>
          )}
          {issueAt && (
            <Text size="2" color="gray">
              {t('project.cadence.issuedAt', {
                when: dateFormatter.format(issueAt),
              })}
            </Text>
          )}
        </Flex>
      )}
      {state === 'scheduled' && (
        <Flex gap="2" align="center">
          <Checkbox
            id={consentId}
            checked={consent === 'consented'}
            onCheckedChange={(checked) => {
              setConsent({ projectId, consented: checked === true })
            }}
          />
          <Text as="label" htmlFor={consentId} size="2">
            {t('project.cadence.consent.label')}
          </Text>
        </Flex>
      )}
      {state === 'scheduled' && consent === 'unanswered' && (
        <Text size="2" color="amber">
          {t('project.cadence.consent.unanswered')}
        </Text>
      )}
      {canEditProjectCadence(view) &&
        (editing ? (
          <CadenceEditor
            saving={saving}
            timezone={
              view?.current?.timezone ??
              Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            weekday={view?.current?.weekday ?? 1}
            cutoffLocal={view?.current?.cutoffLocal ?? '09:00'}
            onCancel={() => setEditing(false)}
            onSave={(cadence) => {
              setCadence({ projectId, cadence })
              setEditing(false)
            }}
          />
        ) : (
          <Actions>
            <Button
              size="s"
              variant="outline"
              color="neutral"
              onClick={() => setEditing(true)}
            >
              {t(
                state === 'off'
                  ? 'project.cadence.actions.set'
                  : 'project.cadence.actions.change',
              )}
            </Button>
          </Actions>
        ))}
    </Flex>
  )
}

type EditorProps = {
  weekday: number
  timezone: string
  cutoffLocal: string
  saving: boolean
  onCancel: () => void
  onSave: (cadence: {
    weekday: number
    timezone: string
    cutoffLocal: string
  }) => void
}

/**
 * The owner's form. A new version starts now, which is what an owner editing
 * the rule today means - what the schedule has already issued keeps the rule
 * it was issued under.
 */
const CadenceEditor = ({
  weekday,
  timezone,
  cutoffLocal,
  saving,
  onCancel,
  onSave,
}: EditorProps) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState({ weekday, timezone, cutoffLocal })

  const weekdayOptions = CADENCE_WEEKDAY_KEYS.map((key, index) => ({
    value: String(index),
    label: t(key),
  }))

  return (
    <Flex direction="column" gap="3" minWidth="0">
      <Select
        label={t('project.cadence.field.weekday')}
        options={weekdayOptions}
        value={String(draft.weekday)}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            weekday: Number(Array.isArray(value) ? value[0] : value),
          }))
        }
      />
      <Input
        label={t('project.cadence.field.cutoff')}
        type="time"
        value={draft.cutoffLocal}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            cutoffLocal: event.target.value,
          }))
        }
      />
      <Select
        label={t('project.cadence.field.timezone')}
        options={cadenceTimezoneOptions(draft.timezone)}
        value={draft.timezone}
        menuMaxHeight={240}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            timezone: Array.isArray(value) ? value[0] : value,
          }))
        }
      />
      <Text size="1" color="gray">
        {t('project.cadence.field.note')}
      </Text>
      <Actions>
        <Button
          size="s"
          variant="outline"
          color="neutral"
          onClick={onCancel}
          disabled={saving}
        >
          {t('common.cancel')}
        </Button>
        <Button
          size="s"
          loading={saving}
          disabled={saving || draft.cutoffLocal === ''}
          onClick={() => onSave(draft)}
        >
          {t('common.save')}
        </Button>
      </Actions>
    </Flex>
  )
}

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: var(--space-3);
`
