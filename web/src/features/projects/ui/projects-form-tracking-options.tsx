import { Flex } from '@radix-ui/themes'
import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ProjectFormValues } from '../model'

import { Checkbox, Text } from '@/shared'

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
                  disabled={disabled}
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
    </Flex>
  )
}
