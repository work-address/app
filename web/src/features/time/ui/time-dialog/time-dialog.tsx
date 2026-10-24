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

import { TimeDialogAgents, useEntryAgentRuns } from './time-dialog-agents'
import { TimeDialogFooter } from './time-dialog-footer'
import { TimeDialogMetrics } from './time-dialog-metrics'
import { TimeDialogNav } from './time-dialog-nav'
import { getTimeApps, TimeDialogProcesses } from './time-dialog-processes'

import type { Time } from '@/entities/time'

import {
  deleteTimeMutation,
  editTimeMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
} from '@/entities/time'
import {
  AdaptiveDialog,
  DIALOG_WIDTH_WIDE,
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
  const hasProcesses = getTimeApps(row ?? undefined).length > 0
  const agentRuns = useEntryAgentRuns(row)
  const hasAgents = agentRuns.length > 0
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
      desktopWidth={
        hasScreenshot && hasAgents
          ? WIDTH_THREE_COLUMNS
          : hasScreenshot
            ? '1000px'
            : hasAgents
              ? DIALOG_WIDTH_WIDE
              : '540px'
      }
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
          <Content
            data-screenshot={hasScreenshot || undefined}
            data-agents={hasAgents || undefined}
          >
            {hasScreenshot && screenshotSrc && (
              <ScreenshotColumn>
                <Shot>
                  <Text size="2" weight="medium">
                    {t('dashboard.worklogsTable.head.screenshot')}
                  </Text>
                  <Screenshot
                    src={screenshotSrc}
                    alt={row.project?.title ?? ''}
                  />
                </Shot>
                <TimeDialogMetrics row={row} range={rangeLabel} />
              </ScreenshotColumn>
            )}
            <DetailsColumn>
              {!hasScreenshot && (
                <TimeDialogMetrics row={row} range={rangeLabel} />
              )}
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
              {hasProcesses && row && <TimeDialogProcesses time={row} />}
            </DetailsColumn>
            {hasAgents && (
              <AgentsColumn>
                <TimeDialogAgents items={agentRuns} />
              </AgentsColumn>
            )}
          </Content>
        </>
      )}
    </AdaptiveDialog>
  )
}

// Screenshot, details and agent runs side by side, never wider than the window.
const WIDTH_THREE_COLUMNS = 'min(1320px, calc(100vw - 48px))'

const Content = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
  width: 100%;

  ${(p) => p.theme.breakpoints.up('md')} {
    column-gap: var(--space-6);

    &[data-screenshot] {
      grid-template-columns: minmax(0, 540px) minmax(0, 1fr);
    }

    &[data-agents]:not([data-screenshot]) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    /* Too narrow for three: the runs take a full row under the other two. */
    &[data-screenshot][data-agents] {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    }
  }

  ${(p) => p.theme.breakpoints.up('lg')} {
    &[data-screenshot][data-agents] {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr);
    }
  }
`

const DetailsColumn = styled.div`
  display: grid;
  gap: var(--space-4);
  min-width: 0;
`

const AgentsColumn = styled.div`
  min-width: 0;

  ${(p) => p.theme.breakpoints.between('md', 'lg')} {
    [data-screenshot] > & {
      grid-column: 1 / -1;
    }
  }
`

const ScreenshotColumn = styled.div`
  display: grid;
  gap: var(--space-4);
  min-width: 0;
`

// Labelled like the other columns, so all three start on one line.
const Shot = styled.div`
  display: grid;
  gap: var(--space-2);
`

// Scales with its column at its own shape: no empty band under a wide shot.
const Screenshot = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
`
