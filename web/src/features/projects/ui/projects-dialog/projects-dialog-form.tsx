import { Flex, Separator } from '@radix-ui/themes'
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
      <Flex direction="column" gap="4">
        <Input
          label={t('dashboard.projectsTable.form.projectName')}
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
          options={stateOptions}
          fallbackValue="Active"
          id="state"
          disabled={isPending}
          hasError={Boolean(errors.state)}
          inputProps={inputProps}
        />
        <Input
          label={t('dashboard.projectsTable.form.rate')}
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
        <Separator size="4" />
        <TextArea
          label={t('dashboard.projectsTable.form.description')}
          placeholder={t('project.createModal.descriptionPlaceholder')}
          rows={3}
          id="description"
          disabled={isPending}
          state={errors.text ? 'error' : 'valid'}
          {...register('text', { required: true })}
        />
        <ProjectsFormTrackingOptions
          control={control}
          disabled={isPending}
          idSuffix="-edit"
        />
        <ProjectsAddCollaborators
          control={control}
          register={register}
          errors={errors}
          disabled={isPending}
          premiumLocked={!user?.premium}
          inputProps={inputProps}
        />
      </Flex>
    </form>
  )
}
