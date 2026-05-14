import { Flex, Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { baseApi } from '@/shared'

import { createActivityMutation } from '@/entities/activities'
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

  const { createActivity, status, resetMutation, pending } = useUnit({
    createActivity: createActivityMutation.start,
    status: createActivityMutation.$status,
    resetMutation: createActivityMutation.reset,
    pending: createActivityMutation.$pending,
  })

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<baseApi.Activity>({
    defaultValues: {
      title: '',
      rateHour: '',
      text: '',
      state: 'Published',
    },
  })

  const inputProps: InputProps = {
    rows: 'auto 1fr',
    columns: '1fr',
    gap: '2',
    size: '3',
  }

  const handleFormSubmit = (data: baseApi.Activity) => {
    createActivity(data)
  }

  useEffect(() => {
    if (!open) {
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

            <TextArea
              label={t('dashboard.projectsTable.form.description')}
              id={'description'}
              placeholder={t('project.createModal.descriptionPlaceholder')}
              rows={isMobile ? 7 : 3}
              disabled={pending}
              state={errors.text ? 'error' : 'valid'}
              {...register('text', { required: true })}
            />
          </Flex>
        </form>
      </Flex>
    </AdaptiveDialog>
  )
}
