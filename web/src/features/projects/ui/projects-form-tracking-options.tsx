import { Flex } from '@radix-ui/themes'
import {
  Controller,
  useController,
  useWatch,
  type Control,
  type ControllerRenderProps,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { reviewWindowHourChoices } from '../lib/tracking-options'

import type { ProjectFormValues } from '../model'

import { Checkbox, Hint, Select, Text } from '@/shared'

type ProjectsFormTrackingOptionsProps = {
  control: Control<ProjectFormValues>
  disabled?: boolean
  /** Suffix keeps checkbox ids unique when several forms share a page. */
  idSuffix?: string
}

const ID_PREFIX = 'project-form-'
const REVIEW_WINDOW_SELECT_WIDTH = '96px'
// Label above the field, as the other form inputs do.
const STACKED_INPUT = { rows: 'auto auto', columns: '1fr', gap: '2' } as const

const OPTIONS = [
  {
    name: 'trackScreenshots',
    labelKey: 'project.createModal.trackScreenshots',
    hintKey: 'project.form.hint.trackScreenshots',
  },
  {
    name: 'trackAgents',
    labelKey: 'project.createModal.trackAgents',
    hintKey: 'project.form.hint.trackAgents',
  },
  {
    name: 'trackWindowTitles',
    labelKey: 'project.createModal.trackWindowTitles',
    hintKey: 'project.form.hint.trackWindowTitles',
  },
  {
    name: 'trackBrowserDomains',
    labelKey: 'project.createModal.trackBrowserDomains',
    hintKey: 'project.form.hint.trackBrowserDomains',
  },
  {
    name: 'allowManualTime',
    labelKey: 'project.createModal.allowManualTime',
    hintKey: 'project.form.hint.allowManualTime',
  },
  {
    name: 'trackProcesses',
    labelKey: 'project.createModal.trackProcesses',
    hintKey: 'project.form.hint.trackProcesses',
  },
] as const

type SwitchName = (typeof OPTIONS)[number]['name']
type SwitchField = ControllerRenderProps<ProjectFormValues, SwitchName>

export const ProjectsFormTrackingOptions = ({
  control,
  disabled,
  idSuffix = '',
}: ProjectsFormTrackingOptionsProps) => {
  const { t } = useTranslation()
  const apps = useWatch({ control, name: 'trackProcesses' })
  // Titles and domains require apps. They are held here, outside the loop, so
  // switching apps off can switch them off too: the form then shows exactly
  // what the server will store instead of a checked box that cannot be used.
  const titles = useController({ control, name: 'trackWindowTitles' })
  const domains = useController({ control, name: 'trackBrowserDomains' })
  const detailFields: Partial<Record<SwitchName, SwitchField>> = {
    trackWindowTitles: titles.field,
    trackBrowserDomains: domains.field,
  }

  const renderSwitch = (name: SwitchName, id: string, field: SwitchField) => (
    <Checkbox
      id={id}
      checked={field.value}
      disabled={disabled || (name in detailFields && !apps)}
      onCheckedChange={(checked) => {
        const on = checked === true
        field.onChange(on)
        if (name === 'trackProcesses' && !on) {
          titles.field.onChange(false)
          domains.field.onChange(false)
        }
      }}
    />
  )

  return (
    <Flex direction={'column'} gap={'3'}>
      {OPTIONS.map(({ name, labelKey, hintKey }) => {
        const id = `${ID_PREFIX}${name}${idSuffix}`
        const held = detailFields[name]

        return (
          <Flex key={name} gap={'2'} align={'center'}>
            {held ? (
              renderSwitch(name, id, held)
            ) : (
              <Controller
                control={control}
                name={name}
                render={({ field }) => renderSwitch(name, id, field)}
              />
            )}
            <Text as="label" htmlFor={id} size={'3'}>
              <LabelWithHint label={t(labelKey)} hint={t(hintKey)} />
            </Text>
          </Flex>
        )
      })}
      <Controller
        control={control}
        name="reviewWindowHours"
        render={({ field }) => (
          <Select
            label={t('project.createModal.reviewWindowHours')}
            hint={t('project.form.hint.reviewWindowHours')}
            options={reviewWindowHourChoices(field.value).map((hours) => ({
              value: String(hours),
              label: String(hours),
            }))}
            value={String(field.value)}
            onChange={(value) => {
              if (!Array.isArray(value)) {
                field.onChange(Number(value))
              }
            }}
            inputProps={{
              ...STACKED_INPUT,
              // Two-digit hours need no more; the full column width read as a text field.
              style: { width: REVIEW_WINDOW_SELECT_WIDTH },
              disabled,
              id: `${ID_PREFIX}reviewWindowHours${idSuffix}`,
            }}
          />
        )}
      />
    </Flex>
  )
}

/**
 * The hint follows the label's last word, so a wrapping label never leaves the
 * question mark alone on a line or pushed to the row's far edge.
 */
const LabelWithHint = ({ label, hint }: { label: string; hint: string }) => {
  const split = label.lastIndexOf(' ')
  return (
    <>
      {split > 0 ? `${label.slice(0, split)} ` : null}
      <span style={{ whiteSpace: 'nowrap' }}>
        {split > 0 ? label.slice(split + 1) : label}{' '}
        <Hint content={hint} size={13} />
      </span>
    </>
  )
}
