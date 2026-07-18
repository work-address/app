import { Flex, Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  AddCollaborators,
  mapCollaboratorsToAddresses,
  type ProjectFormValues,
} from './add-collaborators'
import { ProjectFormSelect, ProjectFormTrackingOptions } from './project-form'

import { createProjectMutation } from '@/entities/projects'
import {
  AdaptiveDialog,
  Button,
  Input,
  type InputProps,
  showToast,
  Text,
  TextArea,
  useBreakpoint,
  Spinner,
} from '@/shared'

type CreateProjectPayload = {
  name: string
  rate: string
  description: string
}

type CreateProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (payload: CreateProjectPayload) => void
}

export const CreateProjectModal = ({
  open,
  onOpenChange,
}: CreateProjectModalProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')

  const { createProject, status, resetMutation, pending } = useUnit({
    createProject: createProjectMutation.start,
    status: createProjectMutation.$status,
    resetMutation: createProjectMutation.reset,
    pending: createProjectMutation.$pending,
  })

  const {
    register,
    handleSubmit,
    reset: resetForm,
    control,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      title: '',
      rateHour: '',
      text: '',
      state: 'Active',
      collaborators: [],
      trackScreenshots: false,
      trackProcesses: false,
    },
  })

  const stateOptions = useMemo(
    () => [
      {
        value: 'Active',
        label: t('dashboard.projectsTable.status.active'),
      },
      {
        value: 'Inactive',
        label: t('dashboard.page.tabs.inactive'),
      },
    ],
    [t],
  )

  const inputProps: InputProps = {
    rows: 'auto 1fr',
    columns: '1fr',
    gap: '2',
    size: '3',
  }

  const handleFormSubmit = (data: ProjectFormValues) => {
    const { workerAddresses, viewerAddresses } = mapCollaboratorsToAddresses(
      data.collaborators,
    )

    createProject({
      title: data.title,
      rateHour: data.rateHour,
      text: data.text,
      state: data.state,
      workerAddresses,
      viewerAddresses,
      trackScreenshots: data.trackScreenshots,
      trackProcesses: data.trackProcesses,
    })
  }

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }

    if (status === 'done') {
      onOpenChange(false)
      resetMutation()
      resetForm()

      showToast('success', {
        message: t('project.createModal.createSuccess'),
        position: 'top-center',
      })
    } else if (status === 'fail') {
      showToast('error', {
        message: t('project.createModal.createError'),
        position: 'top-center',
      })
    }
  }, [status, onOpenChange, t, resetMutation, open, resetForm])

  return (
    <AdaptiveDialog
      desktopPadding={'var(--space-5)'}
      desktopWidth={'600px'}
      onOpenChange={onOpenChange}
      open={open}
      title={<>{t('project.createModal.title')}</>}
      footer={
        isMobile ? (
          <Grid gap={'3'} columns={'1fr 1fr'}>
            <Button
              themeVariant={'secondary'}
              onClick={() => onOpenChange(false)}
            >
              {t('dashboard.projectsTable.confirmDelete.cancel')}
            </Button>
            <Button
              themeVariant={'primary'}
              type="submit"
              form="create-project-form"
              disabled={pending}
            >
              {pending && <Spinner color="#FFF" width="2px" size={15} />}
              {t('dashboard.page.createProject')}
            </Button>
          </Grid>
        ) : (
          <Flex gap={'3'} justify={'end'}>
            <Button
              themeVariant={'secondary'}
              size={'3'}
              onClick={() => onOpenChange(false)}
            >
              {t('dashboard.projectsTable.confirmDelete.cancel')}
            </Button>
            <Button
              themeVariant={'primary'}
              size={'3'}
              type="submit"
              form="create-project-form"
              disabled={pending}
            >
              {pending && <Spinner color="#FFF" width={'2px'} />}
              {t('dashboard.page.createProject')}
            </Button>
          </Flex>
        )
      }
    >
      <Flex gap={'5'} direction={'column'}>
        <Text color={isMobile ? 'gray' : undefined} size={isMobile ? '2' : '3'}>
          {t('project.createModal.intro')}
        </Text>
        <form
          id="create-project-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <Flex gap={'4'} direction={'column'}>
            <Input
              label={t('dashboard.projectsTable.form.projectName')}
              id={'projectName'}
              placeholder={t('project.createModal.projectNamePlaceholder')}
              disabled={pending}
              state={errors.title ? 'error' : 'valid'}
              {...inputProps}
              {...register('title', { required: true })}
            />
            <Grid columns={'1fr 1fr'} gap={'2'}>
              <Input
                label={t('dashboard.projectsTable.form.rate')}
                id={'rate'}
                placeholder={t('project.createModal.ratePlaceholder')}
                addonRight={'$'}
                disabled={pending}
                inputMode="decimal"
                state={errors.rateHour ? 'error' : 'valid'}
                {...inputProps}
                {...register('rateHour', { required: true })}
              />
              <ProjectFormSelect
                control={control}
                name="state"
                label={t('dashboard.projectsTable.form.status')}
                options={stateOptions}
                fallbackValue={'Active'}
                id={'state'}
                disabled={pending}
                hasError={Boolean(errors.state)}
                inputProps={inputProps}
              />
            </Grid>
            <TextArea
              label={t('dashboard.projectsTable.form.description')}
              id={'description'}
              placeholder={t('project.createModal.descriptionPlaceholder')}
              rows={isMobile ? 7 : 3}
              disabled={pending}
              state={errors.text ? 'error' : 'valid'}
              {...register('text', { required: true })}
            />
            <ProjectFormTrackingOptions control={control} disabled={pending} />
            <AddCollaborators
              control={control}
              register={register}
              errors={errors}
              disabled={pending}
              inputProps={inputProps}
            />
          </Flex>
        </form>
      </Flex>
    </AdaptiveDialog>
  )
}
