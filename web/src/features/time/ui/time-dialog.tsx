import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import {
  deleteWorklogMutation,
  editWorklogMutation,
  removeWorklogProcessesMutation,
  removeWorklogScreenshotMutation,
} from '@/entities/time'
import {
  AdaptiveDialog,
  Button,
  formatDurationFromMinutes,
  Spinner,
  Text,
  TextArea,
  toImageDataUrl,
  useBreakpoint,
  useConfirm,
} from '@/shared'

type TimeDialogProps = {
  open: boolean
  row: Time | null
  onOpenChange: (open: boolean) => void
}

export const TimeDialog = ({ open, row, onOpenChange }: TimeDialogProps) => {
  const { t, i18n } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  const {
    deleteWorklog,
    editWorklog,
    removeScreenshot,
    removeProcesses,
    deleteStatus,
    editStatus,
    removeScreenshotStatus,
    removeProcessesStatus,
    resetDelete,
    resetEdit,
    resetRemoveScreenshot,
    resetRemoveProcesses,
  } = useUnit({
    deleteWorklog: deleteWorklogMutation.start,
    editWorklog: editWorklogMutation.start,
    removeScreenshot: removeWorklogScreenshotMutation.start,
    removeProcesses: removeWorklogProcessesMutation.start,
    deleteStatus: deleteWorklogMutation.$status,
    editStatus: editWorklogMutation.$status,
    removeScreenshotStatus: removeWorklogScreenshotMutation.$status,
    removeProcessesStatus: removeWorklogProcessesMutation.$status,
    resetDelete: deleteWorklogMutation.reset,
    resetEdit: editWorklogMutation.reset,
    resetRemoveScreenshot: removeWorklogScreenshotMutation.reset,
    resetRemoveProcesses: removeWorklogProcessesMutation.reset,
  })

  const [note, setNote] = useState('')
  const [screenshotRemoved, setScreenshotRemoved] = useState(false)
  const [processesRemoved, setProcessesRemoved] = useState(false)

  useEffect(() => {
    if (!open || !row) {
      return
    }

    setNote(row.note ?? '')
    setScreenshotRemoved(false)
    setProcessesRemoved(false)
  }, [open, row])

  useEffect(() => {
    if (!open) {
      return
    }

    if (editStatus === 'done') {
      resetEdit()
      onOpenChange(false)
    }
  }, [open, editStatus, resetEdit, onOpenChange])

  useEffect(() => {
    if (!open) {
      return
    }

    if (deleteStatus === 'done') {
      resetDelete()
    }

    if (removeScreenshotStatus === 'done') {
      setScreenshotRemoved(true)
      resetRemoveScreenshot()
    }

    if (removeProcessesStatus === 'done') {
      setProcessesRemoved(true)
      resetRemoveProcesses()
    }
  }, [
    open,
    deleteStatus,
    removeScreenshotStatus,
    removeProcessesStatus,
    resetDelete,
    resetRemoveScreenshot,
    resetRemoveProcesses,
  ])

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

  const paymentStatus = row?.isPaid ? 'paid' : 'unpaid'
  const hasScreenshot = Boolean(row?.screenshot) && !screenshotRemoved
  const hasProcesses =
    Boolean(row?.processes && row.processes.length > 0) && !processesRemoved
  const isPending =
    deleteStatus === 'pending' ||
    editStatus === 'pending' ||
    removeScreenshotStatus === 'pending' ||
    removeProcessesStatus === 'pending'

  const handleDelete = () => {
    if (!row?.id) {
      return
    }

    void confirm({
      title: t('dashboard.worklogsTable.confirmDelete.title'),
      description: t('dashboard.worklogsTable.confirmDelete.description'),
      confirmLabel: t('dashboard.worklogsTable.confirmDelete.confirm'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        deleteWorklog(row.id!)
      },
    })
  }

  const handleRemoveScreenshot = () => {
    if (!row?.id) {
      return
    }

    void confirm({
      title: t('dashboard.worklogsTable.confirmRemoveScreenshot.title'),
      description: t(
        'dashboard.worklogsTable.confirmRemoveScreenshot.description',
      ),
      confirmLabel: t(
        'dashboard.worklogsTable.confirmRemoveScreenshot.confirm',
      ),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        removeScreenshot(row.id!)
      },
    })
  }

  const handleRemoveProcesses = () => {
    if (!row?.id) {
      return
    }

    void confirm({
      title: t('dashboard.worklogsTable.confirmRemoveProcesses.title'),
      description: t(
        'dashboard.worklogsTable.confirmRemoveProcesses.description',
      ),
      confirmLabel: t('dashboard.worklogsTable.confirmRemoveProcesses.confirm'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        removeProcesses(row.id!)
      },
    })
  }

  const handleSave = () => {
    if (!row?.id) {
      return
    }

    editWorklog({ id: row.id, note })
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
      footer={
        isDesktop && row ? (
          <Flex direction="column" gap="3" width="100%">
            {!hasScreenshot && hasProcesses && (
              <Button
                themeVariant="danger"
                size="3"
                type="button"
                disabled={isPending}
                onClick={handleRemoveProcesses}
              >
                {t('dashboard.worklogsTable.removeProcesses')}
              </Button>
            )}
            <Flex justify="between" align="center" width="100%">
              <Flex gap="3">
                <Button
                  color="red"
                  size="3"
                  type="button"
                  disabled={isPending}
                  onClick={handleDelete}
                >
                  {t('dashboard.worklogsTable.dialog.deleteEntry')}
                </Button>
                {hasScreenshot && (
                  <Button
                    themeVariant="danger"
                    size="3"
                    type="button"
                    disabled={isPending}
                    onClick={handleRemoveScreenshot}
                  >
                    {t('dashboard.worklogsTable.removeScreenshot')}
                  </Button>
                )}
                {hasScreenshot && hasProcesses && (
                  <Button
                    themeVariant="danger"
                    size="3"
                    type="button"
                    disabled={isPending}
                    onClick={handleRemoveProcesses}
                  >
                    {t('dashboard.worklogsTable.removeProcesses')}
                  </Button>
                )}
              </Flex>
              <Flex gap="3">
                <Button
                  themeVariant="secondary"
                  size="3"
                  type="button"
                  disabled={isPending}
                  onClick={() => onOpenChange(false)}
                >
                  {t('dashboard.worklogsTable.dialog.discard')}
                </Button>
                <Button
                  themeVariant="primary"
                  size="3"
                  type="button"
                  disabled={isPending}
                  onClick={handleSave}
                >
                  {editStatus === 'pending' && (
                    <Spinner color="#FFF" width="3px" />
                  )}
                  {t('common.save')}
                </Button>
              </Flex>
            </Flex>
          </Flex>
        ) : undefined
      }
    >
      {row && (
        <>
          <Flex align="center" gap="2" mb="4" justify="between">
            <Text size="2">{rangeLabel}</Text>
            <Badge color={row.isPaid ? 'green' : 'red'}>
              {t(`dashboard.worklogsTable.paymentStatus.${paymentStatus}`)}
            </Badge>
          </Flex>
          <Content $singleColumn={!hasScreenshot}>
            {hasScreenshot && (
              <ScreenshotColumn>
                <Screenshot
                  src={toImageDataUrl(row.screenshot)!}
                  alt={row.project?.title ?? ''}
                />
                <TimeDialogMetrics row={row} />
              </ScreenshotColumn>
            )}
            <DetailsColumn $fullWidth={!hasScreenshot}>
              {!hasScreenshot && <TimeDialogMetrics row={row} />}
              <TextArea
                label={t('dashboard.worklogsTable.head.note')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={7}
              />
              {hasProcesses && (
                <TimeDialogProcesses
                  processes={row.processes}
                  columns={hasScreenshot ? 1 : 2}
                />
              )}
            </DetailsColumn>
          </Content>
        </>
      )}
    </AdaptiveDialog>
  )
}

type MetricProps = {
  label: string
  children: ReactNode
}

const Metric = ({ label, children }: MetricProps) => (
  <Flex direction="column" gap="1">
    <Text color="gray" size="2">
      {label}
    </Text>
    <Text size="2" weight="medium">
      {children}
    </Text>
  </Flex>
)

type TimeDialogMetricsProps = {
  row: Time
}

const TimeDialogMetrics = ({ row }: TimeDialogMetricsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.head.activeMetrics')}
      </Text>
      <Flex gap={'4'}>
        <Metric label={t('dashboard.worklogsTable.head.timeActive')}>
          <Badge color="green">
            {formatDurationFromMinutes(row.minutesActive, t)}
          </Badge>
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.keyboard')}>
          {row.keyboardKeys}
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.mouse')}>
          {row.mouseKeys}
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.mouseDistance')}>
          {row.mouseDistance}
        </Metric>
      </Flex>
    </>
  )
}

type WorklogProcessItem = {
  name?: string
  timeMin?: number
}

type TimeDialogProcessesProps = {
  processes?: Time['processes']
  columns?: 1 | 2
}

const TimeDialogProcesses = ({
  processes,
  columns = 1,
}: TimeDialogProcessesProps) => {
  const { t } = useTranslation()

  const processNames = (processes ?? [])
    .map((item) => (item as WorklogProcessItem)?.name)
    .filter((name): name is string => Boolean(name))

  if (processNames.length === 0) {
    return null
  }

  return (
    <Flex direction="column" gap="2" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.confirmRemoveProcesses.processes')}
      </Text>
      <ProcessesList $columns={columns}>
        {processNames.map((name, index) => (
          <Text key={`${name}-${index}`} size="2" color="gray">
            {name}
          </Text>
        ))}
      </ProcessesList>
    </Flex>
  )
}

const ProcessesList = styled.div<{ $columns: 1 | 2 }>`
  display: grid;
  grid-template-columns: ${(p) => (p.$columns === 2 ? '1fr 1fr' : '1fr')};
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
  padding-right: var(--space-2);
  width: 100%;
`

const DetailsColumn = styled.div<{ $fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};

  & > * {
    width: 100%;
  }
`

const Content = styled.div<{ $singleColumn?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  flex-direction: ${(p) => (p.$singleColumn ? 'column' : 'row')};
  width: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
  }
`

const ScreenshotColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex-shrink: 0;
  width: 540px;
  max-width: 100%;
`

const Screenshot = styled.img`
  width: 540px;
  height: 384px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 12px;
`
