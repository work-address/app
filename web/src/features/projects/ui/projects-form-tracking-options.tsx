import { Flex } from '@radix-ui/themes'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

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
  { name: 'trackAgents', labelKey: 'Record AI agents' },
  { name: 'trackWindowTitles', labelKey: 'Record window titles' },
  { name: 'trackBrowserDomains', labelKey: 'Record browser hostnames' },
  { name: 'allowManualTime', labelKey: 'Allow manual entries and web timer' },
  {
    name: 'trackProcesses',
    labelKey: 'project.createModal.trackProcesses',
  },
] as const

export const ProjectsFormTrackingOptions = ({
  control,
  disabled,
  idSuffix = '',
}: ProjectsFormTrackingOptionsProps) => {
  const { t } = useTranslation()
  const apps = useWatch({ control, name: 'trackProcesses' })

  return (
    <Flex direction={'column'} gap={'3'}>
      {OPTIONS.map(({ name, labelKey }) => {
        const id = `${ID_PREFIX}${name}${idSuffix}`

        return (
          <Flex key={name} gap={'2'} align={'center'}>
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <Checkbox
                  id={id}
                  checked={field.value}
                  disabled={
                    disabled ||
                    ((name === 'trackWindowTitles' ||
                      name === 'trackBrowserDomains') &&
                      !apps)
                  }
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true)
                  }}
                />
              )}
            />
            <Text as="label" htmlFor={id} size={'3'}>
              {t(labelKey)}
            </Text>
          </Flex>
        )
      })}
      <Controller
        control={control}
        name="reviewWindowHours"
        render={({ field }) => (
          <Input
            label={t('Review window (hours)')}
            type="number"
            min={1}
            max={24}
            value={String(field.value ?? 24)}
            disabled={disabled}
            onChange={(event) => field.onChange(Number(event.target.value))}
          />
        )}
      />
      <Controller
        control={control}
        name="screenshotRetentionDays"
        render={({ field }) => (
          <Input
            label={t('Screenshot retention (days; blank keeps screenshots)')}
            type="number"
            min={1}
            max={3650}
            value={field.value == null ? '' : String(field.value)}
            disabled={disabled}
            onChange={(event) =>
              field.onChange(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
        )}
      />
    </Flex>
  )
}
