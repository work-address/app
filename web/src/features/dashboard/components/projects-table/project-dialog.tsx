import {
  QuestionMarkCircledIcon,
  TrashIcon,
  DownloadIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons'
import { Flex, Grid, Separator } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { baseApi } from '@/shared'

import {
  $rawActivities,
  editActivityMutation,
  type ProjectWithStats,
} from '@/entities/activities'
import {
  formatDurationFromMinutes,
  Input,
  Text,
  TextArea,
  useBreakpoint,
  AdaptiveDialog,
  Button,
  IconButton,
  Spinner,
  type InputProps,
  useDateFormatter,
  Select,
} from '@/shared'

type ProjectDialogProps = {
  open: boolean
  setOpen: (state: boolean) => void
  row?: ProjectWithStats | null
  onDeleteClick: (row?: ProjectWithStats | null) => void
}

export const ProjectDialog = ({
  row,
  open,
  setOpen,
  onDeleteClick,
}: ProjectDialogProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view')

  const { editingStatus, resetEditingMutation } = useUnit({
    editingStatus: editActivityMutation.$status,
    resetEditingMutation: editActivityMutation.reset,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    if (editingStatus === 'done') {
      resetEditingMutation()
      setOpen(false)
    }
  }, [open, editingStatus, resetEditingMutation, setOpen])

  useEffect(() => {
    if (open) {
      setModalMode('view')
    }
  }, [open])

  return (
    <AdaptiveDialog
      title={
        isDesktop ? (
          modalMode === 'view' ? (
            row?.title
          ) : (
            t('dashboard.projectsTable.drawer.editProjectTitle')
          )
        ) : (
          <Flex justify={'between'} align={'center'}>
            <Text>{row?.title}</Text>

            <IconButton
              color={'red'}
              variant={'outline'}
              onClick={() => onDeleteClick(row)}
              type="button"
            >
              <TrashIcon />
            </IconButton>
          </Flex>
        )
      }
      open={open}
      onOpenChange={setOpen}
      desktopWidth={'600px'}
      footer={
        isDesktop ? (
          <Flex justify={'between'}>
            <Button
              color={'red'}
              variant={'outline'}
              size={'3'}
              onClick={() => row && onDeleteClick(row)}
              type="button"
            >
              <TrashIcon />
              {t('common.delete')}
            </Button>

            <Flex gap={'3'}>
              {modalMode === 'view' ? (
                <>
                  <Button
                    themeVariant={'primary'}
                    size={'3'}
                    onClick={(e) => {
                      // Prevent event bubbling to avoid auto from submit
                      e.stopPropagation()
                      e.preventDefault()
                      setModalMode('edit')
                    }}
                    type="button"
                  >
                    <Pencil1Icon />
                    {t('dashboard.projectsTable.drawer.edit')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    themeVariant={'secondary'}
                    onClick={() => setModalMode('view')}
                    size={'3'}
                    type="button"
                  >
                    {t('common.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    size={'3'}
                    form="edit-project-form"
                    type="submit"
                    disabled={editingStatus === 'pending'}
                  >
                    {editingStatus === 'pending' && (
                      <Spinner color="#FFF" width={'3px'} />
                    )}
                    {t('common.save')}
                  </Button>
                </>
              )}
            </Flex>
          </Flex>
        ) : (
          <Grid columns={'1fr 1fr'} gap={'2'}>
            <>
              {modalMode === 'view' ? (
                <>
                  <Button
                    themeVariant={'secondary'}
                    variant={'outline'}
                    type="button"
                  >
                    <DownloadIcon />
                    {t('dashboard.projectsTable.drawer.invoice')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    onClick={(e) => {
                      // Prevent event bubbling to avoid form submit
                      e.preventDefault()
                      e.stopPropagation()
                      setModalMode('edit')
                    }}
                    type="button"
                  >
                    <Pencil1Icon />
                    {t('dashboard.projectsTable.drawer.edit')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    themeVariant={'secondary'}
                    onClick={() => setModalMode('view')}
                    type="button"
                  >
                    {t('common.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    form="edit-project-form"
                    type="submit"
                    disabled={editingStatus === 'pending'}
                    autoFocus={false}
                  >
                    {editingStatus === 'pending' && (
                      <Spinner width="2px" color="#FFF" size={15} />
                    )}
                    {t('common.save')}
                  </Button>
                </>
              )}
            </>
          </Grid>
        )
      }
    >
      {row && <ProjectDialogContent data={row} mode={modalMode} />}
    </AdaptiveDialog>
  )
}

type ProjectRowKeys = (keyof ProjectWithStats)[]

type ProjectDialogContentProps = {
  data: ProjectWithStats
  mode: 'view' | 'edit'
}

type FormValues = Pick<baseApi.Project, 'title' | 'rateHour' | 'text' | 'state'>

export const ProjectDialogContent = ({
  data,
  mode,
}: ProjectDialogContentProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')
  const dateFormatter = useDateFormatter()

  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
    control,
  } = useForm<FormValues>({
    values: {
      title: data.title,
      state: data.state,
      rateHour: data.rateHour.toString(),
      text: data.text,
    },
  })

  const { editActivity, editingStatus } = useUnit({
    editActivity: editActivityMutation.start,
    editingStatus: editActivityMutation.$status,
  })

  const textSize = isMobile ? '2' : '3'

  const editingActivity = useStoreMap({
    store: $rawActivities,
    keys: [data.id],
    fn: (activities, [id]) => (id ? activities[id] : null),
  })

  const handleFormSubmit = (data: FormValues) => {
    if (editingActivity) {
      editActivity({
        ...editingActivity,
        ...data,
      })
    }
  }

  useEffect(() => {
    if (editingStatus === 'done') {
      resetForm()
    }
  }, [editingStatus, resetForm])

  const stateOptions = useMemo(
    () => [
      { label: 'Active', value: 'Active' },
      { label: 'Inactive', value: 'Inactive' },
    ],
    [],
  )

  if (mode === 'edit') {
    const inputProps: InputProps = {
      rows: 'auto auto',
      columns: '1fr',
      gap: '2',
      size: '3',
    }

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit(handleFormSubmit)}
        id="edit-project-form"
      >
        <Flex direction={'column'} gap={'4'}>
          <Input
            label={'Project name'}
            id={'projectName'}
            disabled={editingStatus === 'pending'}
            state={errors.title ? 'error' : 'valid'}
            {...inputProps}
            {...register('title', { required: true })}
          />

          <Controller
            render={({ field }) => (
              <Select
                label={'Published in'}
                options={stateOptions}
                disabled={editingStatus === 'pending'}
                inputProps={{
                  ...inputProps,
                  state: errors.state ? 'error' : 'valid',
                  id: 'state',
                }}
                {...field}
              />
            )}
            name="state"
            control={control}
            disabled={editingStatus === 'pending'}
          />

          <Input
            label={'Rate'}
            addonRight={'$'}
            id={'rate'}
            disabled={editingStatus === 'pending'}
            state={errors.rateHour ? 'error' : 'valid'}
            {...inputProps}
            {...register('rateHour', { required: true })}
          />

          <Separator size={'4'} />

          <TextArea
            label={'Description'}
            placeholder={'Enter a brief description of your project'}
            rows={7}
            id={'description'}
            size={'3'}
            disabled={editingStatus === 'pending'}
            state={errors.text ? 'error' : 'valid'}
            {...register('text', { required: true })}
          />
        </Flex>
      </form>
    )
  }

  return (
    <Flex direction={'column'} gap={isDesktop ? '4' : '3'}>
      <Grid columns={{ initial: '125px 1fr' }} gap={isDesktop ? '4' : '3'}>
        {(['createdAt', 'state', 'rateHour'] satisfies ProjectRowKeys).map(
          (key) => {
            return (
              <Fragment key={key}>
                <Text color={'gray'} size={textSize}>
                  {t(`dashboard.projectsTable.drawer.meta.${key}`)}
                </Text>

                <Text weight={'medium'} size={textSize}>
                  {key === 'createdAt' && data[key]
                    ? dateFormatter.format(new Date(data[key]))
                    : data[key]}
                </Text>
              </Fragment>
            )
          },
        )}
      </Grid>

      {isMobile && (
        <>
          <Separator size={'4'} />

          <Grid columns={{ initial: '125px 1fr' }} gap={isDesktop ? '4' : '3'}>
            {(
              [
                'timeTotal',
                'timeActive',
                'keyboardKeys',
                'mouseKeys',
                'mouseDistance',
              ] as const
            ).map((key) => {
              return (
                <>
                  <Flex align={'center'} gap={'2'}>
                    <Text color={'gray'} size={textSize}>
                      {t(`dashboard.projectsTable.head.${key}`)}
                    </Text>

                    <QuestionMarkCircledIcon />
                  </Flex>

                  <Text weight={'medium'} size={textSize}>
                    {key === 'timeTotal' &&
                      formatDurationFromMinutes(data.minutesTotal, t)}

                    {key === 'timeActive' &&
                      formatDurationFromMinutes(data.minutesActive, t)}

                    {key !== 'timeActive' && key !== 'timeTotal' && data[key]}
                  </Text>
                </>
              )
            })}
          </Grid>
        </>
      )}

      <Separator size={'4'} />

      <div>
        <TextArea
          label="Description"
          disabled={true}
          value={data.text}
          rows={12}
          size={'3'}
        />
      </div>
    </Flex>
  )
}
