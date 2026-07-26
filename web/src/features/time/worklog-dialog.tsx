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
  ScreenshotPlaceholder as ScreenshotPlaceholderIcon,
  Spinner,
  Text,
  TextArea,
  useBreakpoint,
  useConfirm,
} from '@/shared'

type WorklogDialogProps = {
  open: boolean
  row: Time | null
  onOpenChange: (open: boolean) => void
}

export const WorklogDialog = ({
  open,
  row,
  onOpenChange,
}: WorklogDialogProps) => {
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
      desktopWidth="1000px"
      desktopShowClose
      footer={
        isDesktop && row ? (
          <Flex justify="between" align="center">
            <Button
              color="red"
              size="3"
              type="button"
              disabled={isPending}
              onClick={handleDelete}
            >
              {t('dashboard.worklogsTable.dialog.deleteEntry')}
            </Button>
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
        ) : undefined
      }
    >
      {row && (
        <>
          <Flex align="center" gap="2" mb="4">
            <Text size="2">{rangeLabel}</Text>
            <Badge color={row.isPaid ? 'green' : 'red'}>
              {t(`dashboard.worklogsTable.paymentStatus.${paymentStatus}`)}
            </Badge>
          </Flex>
          <Content>
            <ScreenshotColumn>
              {hasScreenshot ? (
                <Screenshot
                  src={row.screenshot!}
                  alt={row.project?.title ?? ''}
                />
              ) : (
                <PlaceholderImage
                  aria-label={t('dashboard.worklogsTable.screenshotNoData')}
                />
              )}
              {hasScreenshot && (
                <Button
                  type="button"
                  variant="ghost"
                  width="fit-content"
                  ml="12px"
                  disabled={isPending}
                  onClick={handleRemoveScreenshot}
                >
                  <Text size="3" color="red" style={{ cursor: 'pointer' }}>
                    {t('dashboard.worklogsTable.removeScreenshot')}
                  </Text>
                </Button>
              )}
            </ScreenshotColumn>
            <Flex direction="column" gap="4" style={{ flex: 1, minWidth: 0 }}>
              <TextArea
                label={t('dashboard.worklogsTable.head.note')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={7}
              />
              <Metric label={t('dashboard.worklogsTable.head.timeActive')}>
                <Badge color="green">
                  {formatDurationFromMinutes(row.minutesActive, t)}
                </Badge>
              </Metric>
              <Metric label={t('dashboard.worklogsTable.head.paymentStatus')}>
                <Badge color={row.isPaid ? 'green' : 'red'}>
                  {t(`dashboard.worklogsTable.paymentStatus.${paymentStatus}`)}
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
              {hasProcesses && (
                <Button
                  type="button"
                  variant="ghost"
                  width="fit-content"
                  disabled={isPending}
                  onClick={handleRemoveProcesses}
                >
                  <Text size="3" color="red" style={{ cursor: 'pointer' }}>
                    {t('dashboard.worklogsTable.removeProcesses')}
                  </Text>
                </Button>
              )}
            </Flex>
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

const Content = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
  }
`

const ScreenshotColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
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

const PlaceholderImage = styled(ScreenshotPlaceholderIcon)`
  width: 540px;
  height: 384px;
  max-width: 100%;
  display: block;
`
