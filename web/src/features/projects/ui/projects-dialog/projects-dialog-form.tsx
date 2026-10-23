import { Box, Flex, Grid } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { mapCollaboratorsToAddresses } from '../../model'
import { ProjectsAddCollaborators } from '../projects-add-collaborators'
import { ProjectsFormSelect } from '../projects-form-select'
import { ProjectsFormTrackingOptions } from '../projects-form-tracking-options'

import type { ProjectFormValues } from '../../model'

import { $user } from '@/entities/profile'
import { $rawProjects, editProjectMutation } from '@/entities/projects'
import { Input, Text, TextArea, type InputProps, BASE_CURRENCY } from '@/shared'

type ProjectsDialogFormProps = {
  projectId: string
  defaultValues: ProjectFormValues
}

export const ProjectsDialogForm = ({
  projectId,
  defaultValues,
}: ProjectsDialogFormProps) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
    control,
  } = useForm<ProjectFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    values: defaultValues,
  })

  const { editProject, editingStatus, user } = useUnit({
    editProject: editProjectMutation.start,
    editingStatus: editProjectMutation.$status,
    user: $user,
  })

  const editingProject = useStoreMap({
    store: $rawProjects,
    keys: [projectId],
    fn: (projects, [id]) => (id ? projects[id] : null),
  })

  const isPending = editingStatus === 'pending'

  const handleFormSubmit = (values: ProjectFormValues) => {
    if (!editingProject) {
      return
    }

    const { workerAddresses, viewerAddresses } = mapCollaboratorsToAddresses(
      values.collaborators,
    )

    editProject({
      ...editingProject,
      title: values.title,
      rateHour: values.rateHour,
      text: values.text,
      state: values.state,
      workerAddresses,
      viewerAddresses,
      trackScreenshots: values.trackScreenshots,
      trackProcesses: values.trackProcesses,
      trackAgents: values.trackAgents,
      trackWindowTitles: values.trackWindowTitles,
      trackBrowserDomains: values.trackBrowserDomains,
      allowManualTime: values.allowManualTime,
      reviewWindowHours: values.reviewWindowHours,
      // Screenshots are kept; saving clears a retention set before it was dropped.
      screenshotRetentionDays: null,
    })
  }

  useEffect(() => {
    if (editingStatus === 'done') {
      resetForm()
    }
  }, [editingStatus, resetForm])

  const stateOptions = useMemo(
    () => [
      {
        label: t('dashboard.projectsTable.status.active'),
        value: 'Active',
      },
      {
        label: t('dashboard.page.tabs.inactive'),
        value: 'Inactive',
      },
    ],
    [t],
  )

  const inputProps: InputProps = {
    rows: 'auto auto',
    columns: '1fr',
    gap: '2',
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} id="edit-project-form">
      {/* Details lead and tracking follows; the drawer stacks them in one column. */}
      <Grid
        columns={{ initial: '1', md: 'minmax(0, 1fr) minmax(0, 1fr)' }}
        gap="5"
      >
        <Flex direction="column" gap="4" minWidth="0">
          <Input
            label={t('dashboard.projectsTable.form.projectName')}
            hint={t('project.form.hint.title')}
            id="projectName"
            disabled={isPending}
            state={errors.title ? 'error' : 'valid'}
            {...inputProps}
            {...register('title', { required: true })}
          />
          <ProjectsFormSelect
            control={control}
            name="state"
            label={t('dashboard.projectsTable.form.status')}
            hint={t('project.form.hint.state')}
            options={stateOptions}
            fallbackValue="Active"
            id="state"
            disabled={isPending}
            hasError={Boolean(errors.state)}
            inputProps={inputProps}
          />
          <Input
            label={t('dashboard.projectsTable.form.rate')}
            hint={t('project.form.hint.rate')}
            addonLeft={
              <Text size={'2'} color={'gray'}>
                {BASE_CURRENCY.symbol}
              </Text>
            }
            id="rate"
            inputMode="decimal"
            disabled={isPending}
            state={errors.rateHour ? 'error' : 'valid'}
            {...inputProps}
            {...register('rateHour', { required: true })}
          />
          <TextArea
            label={t('dashboard.projectsTable.form.description')}
            hint={t('project.form.hint.description')}
            placeholder={t('project.createModal.descriptionPlaceholder')}
            rows={3}
            id="description"
            disabled={isPending}
            state={errors.text ? 'error' : 'valid'}
            {...register('text', { required: true })}
          />
        </Flex>
        <ProjectsFormTrackingOptions
          control={control}
          disabled={isPending}
          idSuffix="-edit"
        />
        {/* Address, role and remove need a full row; a column squeezes the address. */}
        <Box gridColumn="1 / -1" minWidth="0">
          <ProjectsAddCollaborators
            control={control}
            register={register}
            errors={errors}
            disabled={isPending}
            premiumLocked={!user?.premium}
            inputProps={inputProps}
          />
        </Box>
      </Grid>
    </form>
  )
}
