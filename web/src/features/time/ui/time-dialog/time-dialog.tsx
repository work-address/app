import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  timeEntryDeleteRequested,
  timeProcessesRemoveRequested,
  timeScreenshotRemoveRequested,
} from '../../model'

import { TimeDialogFooter } from './time-dialog-footer'
import { TimeDialogMetrics } from './time-dialog-metrics'
import { TimeDialogNav } from './time-dialog-nav'
import { TimeDialogProcesses } from './time-dialog-processes'

import type { Time } from '@/entities/time'

import {
  deleteTimeMutation,
  editTimeMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
} from '@/entities/time'
import {
  AdaptiveDialog,
  Select,
  Text,
  TextArea,
  toImageDataUrl,
} from '@/shared'

type PaymentStatusValue = 'paid' | 'unpaid'

type TimeDialogFormValues = {
  note: string
  paymentStatus: PaymentStatusValue
}

type TimeDialogProps = {
  open: boolean
  row: Time | null
  onOpenChange: (open: boolean) => void
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
}

const getFormValues = (row: Time | null): TimeDialogFormValues => ({
  note: row?.note ?? '',
  paymentStatus: row?.isPaid ? 'paid' : 'unpaid',
})

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName

  if (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  ) {
    return true
  }

  return Boolean(
    target.closest(
      '[role="listbox"], [role="option"], [role="combobox"], [data-radix-select-content]',
    ),
  )
}

export const TimeDialog = ({
  open,
  row,
  onOpenChange,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
}: TimeDialogProps) => {
  const { t, i18n } = useTranslation()

  const {
    requestDelete,
    editTimeEntry,
    requestRemoveScreenshot,
    requestRemoveProcesses,
    isDeleting,
    isEditing,
    isRemovingScreenshot,
    isRemovingProcesses,
  } = useUnit({
    requestDelete: timeEntryDeleteRequested,
    editTimeEntry: editTimeMutation.start,
    requestRemoveScreenshot: timeScreenshotRemoveRequested,
    requestRemoveProcesses: timeProcessesRemoveRequested,
    isDeleting: deleteTimeMutation.$pending,
    isEditing: editTimeMutation.$pending,
    isRemovingScreenshot: removeTimeScreenshotMutation.$pending,
    isRemovingProcesses: removeTimeProcessesMutation.$pending,
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<TimeDialogFormValues>({
    defaultValues: getFormValues(null),
  })

  const paymentStatusOptions = [
    {
      value: 'paid' satisfies PaymentStatusValue,
      label: t('dashboard.worklogsTable.paymentStatus.paid'),
    },
    {
      value: 'unpaid' satisfies PaymentStatusValue,
      label: t('dashboard.worklogsTable.paymentStatus.unpaid'),
    },
  ]

  // react-hook-form owns the draft, so seeding it stays a React concern.
  useEffect(() => {
    if (!open || !row) {
      return
    }

    reset(getFormValues(row))
  }, [open, row, reset])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDirty || isEditableTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        if (!hasPrev || !onPrev) {
          return
        }

        event.preventDefault()
        onPrev()
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (!hasNext || !onNext) {
          return
        }

        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, isDirty, hasPrev, hasNext, onPrev, onNext])

  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Derived straight from the row: the feed clears screenshot/processes when
  // the mutation lands, so there is no local copy to keep in step.
  const hasScreenshot = Boolean(row?.screenshot)
  const hasProcesses = Boolean(row?.processes && row.processes.length > 0)
  const isPending =
    isDeleting || isEditing || isRemovingScreenshot || isRemovingProcesses
  const screenshotSrc = hasScreenshot
    ? toImageDataUrl(row?.screenshot)
    : undefined

  const handleDelete = () => {
    if (row?.id) {
      requestDelete(row.id)
    }
  }

  const handleRemoveScreenshot = () => {
    if (row?.id) {
      requestRemoveScreenshot(row.id)
    }
  }

  const handleRemoveProcesses = () => {
    if (row?.id) {
      requestRemoveProcesses(row.id)
    }
  }

  const handleDiscard = () => {
    reset(getFormValues(row))
    onOpenChange(false)
  }

  const onSubmit: SubmitHandler<TimeDialogFormValues> = (values) => {
    if (!row?.id || !isDirty) {
      return
    }

    editTimeEntry({
      id: row.id,
      note: values.note,
      isPaid: values.paymentStatus === 'paid',
    })
  }

  const rangeLabel = row
    ? `${timeFormatter.format(new Date(row.fromAt))} - ${timeFormatter.format(
        new Date(row.toAt),
      )}, ${dateTimeFormatter.format(new Date(row.fromAt))}`
    : ''

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row?.project?.title ?? t('dashboard.page.worklogs.title')}
      desktopWidth={hasScreenshot ? '1000px' : '540px'}
      desktopShowClose
      headerActions={
        row ? (
          <TimeDialogNav
            hasPrev={hasPrev}
            hasNext={hasNext}
            disabled={isDirty || isPending}
            onPrev={onPrev}
            onNext={onNext}
          />
        ) : undefined
      }
      footer={
        row ? (
          <TimeDialogFooter
            isPending={isPending}
            isSaving={isEditing}
            canSave={isDirty}
            hasScreenshot={hasScreenshot}
            hasProcesses={hasProcesses}
            onDelete={handleDelete}
            onRemoveScreenshot={handleRemoveScreenshot}
            onRemoveProcesses={handleRemoveProcesses}
            onDiscard={handleDiscard}
            onSave={handleSubmit(onSubmit)}
          />
        ) : undefined
      }
    >
      {row && (
        <>
          <Flex mb="4">
            <Text size="2">{rangeLabel}</Text>
          </Flex>
          <Content data-single-column={!hasScreenshot || undefined}>
            {hasScreenshot && screenshotSrc && (
              <ScreenshotColumn>
                <Screenshot
                  src={screenshotSrc}
                  alt={row.project?.title ?? ''}
                />
                <TimeDialogMetrics row={row} />
              </ScreenshotColumn>
            )}
            <DetailsColumn data-full-width={!hasScreenshot || undefined}>
              {!hasScreenshot && <TimeDialogMetrics row={row} />}
              <Controller
                name="paymentStatus"
                control={control}
                render={({ field }) => (
                  <Select
                    options={paymentStatusOptions}
                    value={field.value}
                    onChange={(value) => {
                      if (isPending || Array.isArray(value)) {
                        return
                      }

                      field.onChange(value)
                    }}
                    label={t('dashboard.worklogsTable.head.paymentStatus')}
                  />
                )}
              />
              <Controller
                name="note"
                control={control}
                render={({ field }) => (
                  <TextArea
                    id="time-note"
                    label={t('dashboard.worklogsTable.head.note')}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    rows={3}
                    disabled={isPending}
                  />
                )}
              />
              {hasProcesses && (
                <TimeDialogProcesses processes={row.processes} />
              )}
            </DetailsColumn>
          </Content>
        </>
      )}
    </AdaptiveDialog>
  )
}

const Content = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  flex-direction: row;
  width: 100%;

  &[data-single-column] {
    flex-direction: column;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
    gap: var(--space-4);
  }
`

const DetailsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
  width: auto;

  &[data-full-width] {
    width: 100%;
  }

  & > * {
    width: 100%;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`

const ScreenshotColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex-shrink: 0;
  width: 540px;
  max-width: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`

const Screenshot = styled.img`
  width: 540px;
  height: 384px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 12px;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
    height: auto;
  }
`
