import { useStoreMap, useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { mapCollaboratorsToAddresses } from '../../model'
import { ProjectsFormFields } from '../projects-form-fields'

import type { ProjectFormValues } from '../../model'

import { $user } from '@/entities/profile'
import { $rawProjects, editProjectMutation } from '@/entities/projects'
import { useBreakpoint } from '@/shared'

type ProjectsDialogFormProps = {
  projectId: string
  defaultValues: ProjectFormValues
}

export const ProjectsDialogForm = ({
  projectId,
  defaultValues,
}: ProjectsDialogFormProps) => {
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
    control,
    setFocus,
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

  // Edit replaces the Edit button under the pointer with Save: start in the
  // first field instead of leaving focus on a button the person did not press.
  // Not on phones, where focusing a field throws the keyboard over the form.
  const isDesktop = useBreakpoint('isDesktop')
  useEffect(() => {
    if (isDesktop) {
      setFocus('title')
    }
  }, [isDesktop, setFocus])

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} id="edit-project-form">
      <ProjectsFormFields
        control={control}
        register={register}
        errors={errors}
        disabled={isPending}
        premiumLocked={!user?.premium}
        idSuffix="-edit"
      />
    </form>
  )
}
