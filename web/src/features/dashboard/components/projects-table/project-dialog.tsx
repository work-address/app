import {
  QuestionMarkCircledIcon,
  TrashIcon,
  DownloadIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons'
import { Flex, Grid, Separator } from '@radix-ui/themes'
import { Fragment, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ProjectWithStats } from '@/entities/activities'

import {
  formatDurationFromMinutes,
  Input,
  Text,
  TextArea,
  useBreakpoint,
  AdaptiveDialog,
  Button,
  IconButton,
  type InputProps,
} from '@/features/shared'
import { useDateFormatter } from '@/features/shared/hooks/formatters/use-date-formatter'

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
            >
              <TrashIcon />
              {t('common.delete')}
            </Button>

            <Flex gap={'3'}>
              {modalMode === 'view' ? (
                <>
                  <Button
                    themeVariant={'secondary'}
                    variant={'outline'}
                    size={'3'}
                  >
                    <DownloadIcon />
                    {t('dashboard.projectsTable.drawer.invoice')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    size={'3'}
                    onClick={() => setModalMode('edit')}
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
                  >
                    {t('common.cancel')}
                  </Button>

                  <Button themeVariant={'primary'} size={'3'}>
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
                  <Button themeVariant={'secondary'} variant={'outline'}>
                    <DownloadIcon />
                    {t('dashboard.projectsTable.drawer.invoice')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    onClick={() => setModalMode('edit')}
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
                  >
                    {t('common.cancel')}
                  </Button>

                  <Button themeVariant={'primary'}>{t('common.save')}</Button>
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

export const ProjectDialogContent = ({
  data,
  mode,
}: ProjectDialogContentProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')
  const dateFormatter = useDateFormatter()

  const { register } = useForm({
    values: data,
  })

  const textSize = isMobile ? '2' : '3'

  if (mode === 'edit') {
    const inputProps: InputProps = {
      rows: 'auto auto',
      columns: '1fr',
      gap: '2',
      size: '3',
    }

    return (
      <Flex direction={'column'} gap={'4'}>
        <Input
          label={'Project name'}
          id={'projectName'}
          {...inputProps}
          {...register('title')}
        />

        <Input
          label={'Published in'}
          id={'publishedIn'}
          {...inputProps}
          {...register('createdAt')}
        />

        <Input
          label={'Rate'}
          addonRight={'$'}
          id={'rate'}
          {...inputProps}
          {...register('rateHour')}
        />

        <Separator size={'4'} />

        <TextArea
          label={'Description'}
          placeholder={'Enter a brief description of your project'}
          rows={7}
          id={'description'}
          size={'3'}
          {...register('text')}
        />
      </Flex>
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
