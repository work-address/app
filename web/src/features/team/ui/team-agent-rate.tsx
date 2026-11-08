import { useUnit } from 'effector-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  centsToRateInput,
  parseRateCents,
  setAgentRateMutation,
} from '../model'

import { Button, Input, WorkspaceStatus } from '@/shared'

type Props = {
  projectId: string
  agentId: string
  rateHourCents: number
  /** Names the field for a screen reader: several rates sit on one page. */
  label: string
}

/** A worker's own agent rate on one project. Only its worker ever sees this. */
export const TeamAgentRate = ({
  projectId,
  agentId,
  rateHourCents,
  label,
}: Props) => {
  const { t } = useTranslation()
  const { save, pending } = useUnit({
    save: setAgentRateMutation.start,
    pending: setAgentRateMutation.$pending,
  })
  const saved = centsToRateInput(rateHourCents)
  const [value, setValue] = useState(saved)

  // A refetch brings the rate that was actually stored.
  useEffect(() => {
    setValue(saved)
  }, [saved])

  const cents = parseRateCents(value)
  const dirty = value.trim() !== saved
  const invalid = dirty && cents === null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (cents === null || !dirty) {
      return
    }
    save({ projectId, agentId, rateHourCents: cents })
  }

  return (
    <Root onSubmit={submit}>
      <Input
        aria-label={label}
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={pending}
        addonLeft="$"
        addonRight={t('team.rate.perHour')}
        state={invalid ? 'error' : undefined}
        errorMessage={invalid ? t('team.rate.invalid') : undefined}
      />
      {dirty && !invalid ? (
        <Button size="s" type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      ) : rateHourCents === 0 ? (
        <WorkspaceStatus tone="attention">
          {t('team.rate.notBilled')}
        </WorkspaceStatus>
      ) : null}
    </Root>
  )
}

const Root = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 170px) auto;
  align-items: center;
  justify-content: start;
  gap: var(--ui-space-2);

  ${(p) => p.theme.breakpoints.down('sm')} {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;

    /* The amount needs the row's width; the status or Save goes under it. */
    > :first-child {
      width: 100%;
    }
  }
`
