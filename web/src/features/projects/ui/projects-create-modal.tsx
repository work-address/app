import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { DEFAULT_REVIEW_WINDOW_HOURS } from '../lib/tracking-options'
import { mapCollaboratorsToAddresses } from '../model'

import { ProjectsFormFields } from './projects-form-fields'

import type { ProjectFormValues } from '../model'

import { $user } from '@/entities/profile'
import { createProjectMutation } from '@/entities/projects'
import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_WIDE,
  showToast,
  Text,
} from '@/shared'

type ProjectsCreatePayload = {
  name: string
  rate: string
  description: string
}

type ProjectsCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (payload: ProjectsCreatePayload) => void
}

export const ProjectsCreateModal = ({
  open,
  onOpenChange,
}: ProjectsCreateModalProps) => {
  const { t } = useTranslation()

  const { createProject, status, resetMutation, pending, user } = useUnit({
    createProject: createProjectMutation.start,
    status: createProjectMutation.$status,
    resetMutation: createProjectMutation.reset,
    pending: createProjectMutation.$pending,
    user: $user,
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
      trackAgents: false,
      trackWindowTitles: false,
      trackBrowserDomains: false,
      allowManualTime: false,
      reviewWindowHours: DEFAULT_REVIEW_WINDOW_HOURS,
    },
  })

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
      trackAgents: data.trackAgents,
      trackWindowTitles: data.trackWindowTitles,
      trackBrowserDomains: data.trackBrowserDomains,
      allowManualTime: data.allowManualTime,
      reviewWindowHours: data.reviewWindowHours,
      screenshotRetentionDays: null,
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
    }
  }, [status, onOpenChange, t, resetMutation, open, resetForm])

  return (
    <AdaptiveDialog
      desktopWidth={DIALOG_WIDTH_WIDE}
      onOpenChange={onOpenChange}
      open={open}
      title={t('project.createModal.title')}
      footer={
        <Actions>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-project-form" loading={pending}>
            {t('dashboard.page.createProject')}
          </Button>
        </Actions>
      }
    >
      <Body>
        <Text color={'gray'} size={'2'}>
          {t('project.createModal.intro')}
        </Text>
        <form
          id="create-project-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <ProjectsFormFields
            control={control}
            register={register}
            errors={errors}
            disabled={pending}
            premiumLocked={!user?.premium}
          />
        </form>
      </Body>
    </AdaptiveDialog>
  )
}

const Body = styled.div`
  display: grid;
  gap: var(--space-4);
`

// Phones split the row between both buttons; desktops keep them at the end.
const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    grid-template-columns: auto auto;
    justify-content: end;
  }
`
