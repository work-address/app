import { Flex } from '@radix-ui/themes'
import {
  Controller,
  useController,
  useWatch,
  type Control,
  type ControllerRenderProps,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  isValidReviewWindowHours,
  isValidScreenshotRetentionDays,
  readWholeNumber,
} from '../lib/tracking-options'

import type { ProjectFormValues } from '../model'

import { Checkbox, Input, Text } from '@/shared'

type ProjectsFormTrackingOptionsProps = {
  control: Control<ProjectFormValues>
  disabled?: boolean
  /** Suffix keeps checkbox ids unique when several forms share a page. */
  idSuffix?: string
}

const ID_PREFIX = 'project-form-'

const OPTIONS = [
  {
    name: 'trackScreenshots',
    labelKey: 'project.createModal.trackScreenshots',
  },
  { name: 'trackAgents', labelKey: 'project.createModal.trackAgents' },
  {
    name: 'trackWindowTitles',
    labelKey: 'project.createModal.trackWindowTitles',
  },
  {
    name: 'trackBrowserDomains',
    labelKey: 'project.createModal.trackBrowserDomains',
  },
  { name: 'allowManualTime', labelKey: 'project.createModal.allowManualTime' },
  {
    name: 'trackProcesses',
    labelKey: 'project.createModal.trackProcesses',
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
      {OPTIONS.map(({ name, labelKey }) => {
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
              {t(labelKey)}
            </Text>
          </Flex>
        )
      })}
      <Controller
        control={control}
        name="reviewWindowHours"
        rules={{
          validate: (value) =>
            isValidReviewWindowHours(value) ||
            t('project.createModal.reviewWindowHoursInvalid'),
        }}
        render={({ field, fieldState }) => (
          <Input
            label={t('project.createModal.reviewWindowHours')}
            inputMode="numeric"
            value={Number.isFinite(field.value) ? String(field.value) : ''}
            disabled={disabled}
            state={fieldState.error ? 'error' : undefined}
            errorMessage={fieldState.error?.message}
            onBlur={field.onBlur}
            onChange={(event) =>
              // A cleared field is not 0 hours; it is left for validation to name.
              field.onChange(readWholeNumber(event.target.value) ?? Number.NaN)
            }
          />
        )}
      />
      <Controller
        control={control}
        name="screenshotRetentionDays"
        rules={{
          validate: (value) =>
            isValidScreenshotRetentionDays(value) ||
            t('project.createModal.screenshotRetentionDaysInvalid'),
        }}
        render={({ field, fieldState }) => (
          <Input
            label={t('project.createModal.screenshotRetentionDays')}
            inputMode="numeric"
            value={
              field.value == null || !Number.isFinite(field.value)
                ? ''
                : String(field.value)
            }
            disabled={disabled}
            state={fieldState.error ? 'error' : undefined}
            errorMessage={fieldState.error?.message}
            onBlur={field.onBlur}
            onChange={(event) =>
              field.onChange(readWholeNumber(event.target.value))
            }
          />
        )}
      />
    </Flex>
  )
}
