import { PersonIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  mapAddressesToCollaborators,
  mapCollaboratorsToAddresses,
} from '../model'

import { ProjectsAddCollaborators } from './projects-add-collaborators'

import type { ProjectFormValues } from '../model'

import { $rawProjects, editProjectMutation } from '@/entities/projects'
import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_WIDE,
  type InputProps,
} from '@/shared'

const FORM_ID = 'project-people-form'

// Address, role and remove need a full row, as they do in the project form.
const STACKED_INPUT: InputProps = {
  rows: 'auto auto',
  columns: '1fr',
  gap: '2',
}

type Props = {
  projectId: string
}

/**
 * Who is on a project, changed from outside the project dialog. It saves the
 * project as that dialog does, and changes nothing but the two lists.
 */
export const ProjectsPeopleDialog = ({ projectId }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { edit, status, reset } = useUnit({
    edit: editProjectMutation.start,
    status: editProjectMutation.$status,
    reset: editProjectMutation.reset,
  })
  const project = useStoreMap({
    store: $rawProjects,
    keys: [projectId],
    fn: (projects, [id]) => projects[id] ?? null,
  })

  const values = useMemo<ProjectFormValues>(
    () => ({
      title: project?.title ?? '',
      rateHour: project?.rateHour?.toString() ?? '',
      text: project?.text ?? '',
      state: project?.state ?? '',
      collaborators: mapAddressesToCollaborators(
        project?.workerAddresses,
        project?.viewerAddresses,
      ),
      trackScreenshots: project?.trackScreenshots ?? false,
      trackProcesses: project?.trackProcesses ?? false,
      trackAgents: project?.trackAgents ?? false,
      trackWindowTitles: project?.trackWindowTitles ?? false,
      trackBrowserDomains: project?.trackBrowserDomains ?? false,
      allowManualTime: project?.allowManualTime ?? false,
      allowMobileTime: project?.allowMobileTime ?? false,
      trackLocation: project?.trackLocation ?? false,
      reviewWindowHours: project?.reviewWindowHours ?? 24,
    }),
    [project],
  )

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    values,
  })

  const pending = status === 'pending'

  useEffect(() => {
    if (open && status === 'done') {
      reset()
      setOpen(false)
    }
  }, [open, status, reset])

  const submit = ({ collaborators }: ProjectFormValues) => {
    if (project) {
      edit({ ...project, ...mapCollaboratorsToAddresses(collaborators) })
    }
  }

  return (
    <>
      <Button
        size="s"
        variant="soft"
        color="neutral"
        iconLeft={<PersonIcon />}
        disabled={!project}
        onClick={() => setOpen(true)}
      >
        {t('team.project.managePeople')}
      </Button>
      <AdaptiveDialog
        title={t('team.project.peopleTitle', { project: project?.title })}
        open={open}
        onOpenChange={setOpen}
        desktopWidth={DIALOG_WIDTH_WIDE}
        footer={
          <Flex gap="2" justify="end">
            <Button
              variant="soft"
              color="neutral"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={pending}>
              {t('common.save')}
            </Button>
          </Flex>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit(submit)}>
          <ProjectsAddCollaborators
            control={control}
            register={register}
            errors={errors}
            disabled={pending}
            inputProps={STACKED_INPUT}
          />
        </form>
      </AdaptiveDialog>
    </>
  )
}
