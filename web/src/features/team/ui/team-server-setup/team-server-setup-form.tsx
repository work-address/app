import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  isAgentName,
  parseRateCents,
  SERVER_PRODUCT_NAMES,
  SERVER_PRODUCTS,
  sendsPrompts,
  type ServerAgentForm,
  type ServerProduct,
  type TeamProjectData,
} from '../../model'

import { Input, Select, type InputProps } from '@/shared'

// A label over its field: the dialog is one column.
const STACKED: InputProps = { rows: 'auto auto', columns: '1fr', gap: '2' }

const PRODUCT_OPTIONS = SERVER_PRODUCTS.map((product) => ({
  value: product,
  label: SERVER_PRODUCT_NAMES[product],
}))

type Props = {
  id: string
  projects: TeamProjectData[]
  disabled: boolean
  /** A failed attempt already made the agent: its runtime and name stand. */
  agentSettled: boolean
  onSubmit: (form: ServerAgentForm) => void
}

export const TeamServerSetupForm = ({
  id,
  projects,
  disabled,
  agentSettled,
  onSubmit,
}: Props) => {
  const { t } = useTranslation()
  const [product, setProduct] = useState<ServerProduct>('openclaw')
  const productName = SERVER_PRODUCT_NAMES[product]
  // Null until typed: the suggested name then follows the runtime.
  const [typedName, setTypedName] = useState<string | null>(null)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [rate, setRate] = useState('0')
  const [submitted, setSubmitted] = useState(false)

  const name =
    typedName ?? t('team.serverSetup.defaultName', { product: productName })
  const cents = parseRateCents(rate)
  const nameInvalid = !isAgentName(name.trim())
  const project = projects.find((candidate) => candidate.id === projectId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (nameInvalid || cents === null || !project) {
      return
    }
    onSubmit({
      product,
      name: name.trim(),
      projectId: project.id,
      rateHourCents: cents,
    })
  }

  return (
    <Root id={id} onSubmit={submit} noValidate>
      <Notice>{t('team.serverSetup.description')}</Notice>
      <Select
        label={t('team.serverSetup.product')}
        options={PRODUCT_OPTIONS}
        value={product}
        onChange={(value) => setProduct(String(value) as ServerProduct)}
        inputProps={{ ...STACKED, disabled: disabled || agentSettled }}
      />
      <Input
        {...STACKED}
        label={t('team.serverSetup.name')}
        hint={t('team.serverSetup.nameHint')}
        value={name}
        maxLength={60}
        onChange={(event) => setTypedName(event.target.value)}
        disabled={disabled || agentSettled}
        state={submitted && nameInvalid ? 'error' : undefined}
        errorMessage={
          submitted && nameInvalid
            ? t('team.serverSetup.nameInvalid')
            : undefined
        }
      />
      <Select
        label={t('team.serverSetup.project')}
        hint={t('team.serverSetup.projectHint')}
        options={projects.map((candidate) => ({
          value: candidate.id,
          label: candidate.title,
        }))}
        value={projectId}
        onChange={(value) => setProjectId(String(value))}
        inputProps={{ ...STACKED, disabled }}
      />
      {project && !project.trackAgents ? (
        <Notice>
          {t(
            project.role === 'owner'
              ? 'team.serverSetup.recordingOffOwner'
              : 'team.serverSetup.recordingOff',
          )}
        </Notice>
      ) : null}
      <Notice>
        {t('team.serverSetup.recorded')}
        {sendsPrompts(product)
          ? ` ${t('team.serverSetup.recordedPrompt', { product: productName })}`
          : null}
        {project && project.role !== 'owner'
          ? ` ${t('team.serverSetup.ownerSees')}`
          : null}
      </Notice>
      <Input
        {...STACKED}
        label={t('team.serverSetup.rate')}
        hint={t('team.serverSetup.rateHint')}
        inputMode="decimal"
        value={rate}
        onChange={(event) => setRate(event.target.value)}
        disabled={disabled}
        addonLeft="$"
        addonRight={t('team.rate.perHour')}
        state={submitted && cents === null ? 'error' : undefined}
        errorMessage={
          submitted && cents === null ? t('team.rate.invalid') : undefined
        }
      />
    </Root>
  )
}

const Root = styled.form`
  display: grid;
  gap: var(--ui-space-4);
`

const Notice = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`
