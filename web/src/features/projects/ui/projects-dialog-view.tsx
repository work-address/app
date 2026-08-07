import { Flex, Grid, Separator } from '@radix-ui/themes'
import { Fragment, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { mapAddressesToCollaborators } from '../lib'

import { ProjectsAddCollaborators } from './projects-add-collaborators'
import { ProjectsDialogMetrics } from './projects-dialog-metrics'

import type { ProjectFormValues } from '../model'
import type { ProjectWithStats } from '@/entities/projects'

import {
  Text,
  TextArea,
  useBreakpoint,
  useDateFormatter,
  type InputProps,
} from '@/shared'

type ProjectMetaKey = 'createdAt' | 'rateHour'

type ProjectsDialogViewProps = {
  data: ProjectWithStats
}

export const ProjectsDialogView = ({ data }: ProjectsDialogViewProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')
  const dateFormatter = useDateFormatter()
  const textSize = isMobile ? '2' : '3'
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
        {(['createdAt', 'rateHour'] satisfies ProjectMetaKey[]).map((key) => (
          <Fragment key={key}>
            <Text color="gray" size={textSize}>
              {t(`dashboard.projectsTable.drawer.meta.${key}`)}
            </Text>
            <Text weight="medium" size={textSize}>
              {key === 'createdAt' && data[key]
                ? dateFormatter.format(new Date(data[key]))
                : data[key]}
            </Text>
          </Fragment>
        ))}
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
