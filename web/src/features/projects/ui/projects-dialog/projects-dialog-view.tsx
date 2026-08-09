import { Flex, Grid, Separator } from '@radix-ui/themes'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { mapAddressesToCollaborators } from '../../model'
import { ProjectsAddCollaborators } from '../projects-add-collaborators'

import { ProjectsDialogMetrics } from './projects-dialog-metrics'

import type { ProjectFormValues } from '../../model'
import type { ProjectWithStats } from '@/entities/projects'

import {
  Text,
  TextArea,
  useBreakpoint,
  useDateFormatter,
  formatAmount,
  type InputProps,
  BASE_CURRENCY,
} from '@/shared'

type ProjectsDialogViewProps = {
  data: ProjectWithStats
}

export const ProjectsDialogView = ({ data }: ProjectsDialogViewProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const dateFormatter = useDateFormatter()
  const gap = isDesktop ? '4' : '3'

  const collaborators = useMemo(
    () =>
      mapAddressesToCollaborators(data.workerAddresses, data.viewerAddresses),
    [data.workerAddresses, data.viewerAddresses],
  )

  const { control, register, formState } = useForm<ProjectFormValues>({
    values: {
      title: data.title ?? '',
      state: data.state ?? 'Active',
      rateHour: data.rateHour.toString(),
      text: data.text ?? '',
      collaborators,
      trackScreenshots: data.trackScreenshots ?? false,
      trackProcesses: data.trackProcesses ?? false,
    },
  })

  const collaboratorInputProps: InputProps = {
    rows: 'auto auto',
    columns: '1fr',
    gap: '2',
    size: '3',
  }

  return (
    <Flex direction="column" gap={gap}>
      <Grid columns={{ initial: '125px 1fr' }} gap={gap}>
        <Text color="gray" size="2">
          {t(`dashboard.projectsTable.drawer.meta.createdAt`)}
        </Text>
        <Text size="2" weight="medium">
          {dateFormatter.format(new Date(data.createdAt ?? new Date()))}
        </Text>
        <Text color="gray" size="2">
          {t(`dashboard.projectsTable.drawer.meta.rateHour`)}
        </Text>
        <Text size="2" weight="medium">
          {formatAmount(data.rateHour)} {BASE_CURRENCY.code}
        </Text>
      </Grid>
      <Separator size="4" />
      <ProjectsDialogMetrics data={data} />
      <Separator size="4" />
      <TextArea
        label={t('dashboard.projectsTable.drawer.section.description')}
        disabled
        value={data.text}
        rows={3}
        size="3"
      />
      {collaborators.length > 0 && (
        <>
          <Separator size="4" />
          <ProjectsAddCollaborators
            control={control}
            register={register}
            errors={formState.errors}
            readOnly
            inputProps={collaboratorInputProps}
          />
        </>
      )}
    </Flex>
  )
}
