import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { ProcessesIcon, ScreenshotsIcon, Tooltip, Button } from '@/shared'

type TimeDialogFooterProps = {
  isPending: boolean
  isSaving: boolean
  canSave: boolean
  hasScreenshot: boolean
  hasProcesses: boolean
  onDelete: () => void
  onRemoveScreenshot: () => void
  onRemoveProcesses: () => void
  onDiscard: () => void
  onSave: () => void
}

export const TimeDialogFooter = ({
  isPending,
  isSaving,
  canSave,
  hasScreenshot,
  hasProcesses,
  onDelete,
  onRemoveScreenshot,
  onRemoveProcesses,
  onDiscard,
  onSave,
}: TimeDialogFooterProps) => {
  const { t } = useTranslation()

  return (
    <Flex justify="between" align="center" width="100%">
      <Flex gap="3">
        <Button color="danger" size="l" disabled={isPending} onClick={onDelete}>
          {t('dashboard.worklogsTable.dialog.deleteEntry')}
        </Button>
        {hasScreenshot && (
          <Tooltip content={t('dashboard.worklogsTable.removeScreenshot')}>
            <span>
              <Button
                color="danger"
                variant="soft"
                size="l"
                disabled={isPending}
                onClick={onRemoveScreenshot}
                aria-label={t('dashboard.worklogsTable.removeScreenshot')}
              >
                <ScreenshotsIcon width={20} height={20} />
              </Button>
            </span>
          </Tooltip>
        )}
        {hasProcesses && (
          <Tooltip content={t('dashboard.worklogsTable.removeProcesses')}>
            <span>
              <Button
                color="danger"
                variant="soft"
                size="l"
                disabled={isPending}
                onClick={onRemoveProcesses}
                aria-label={t('dashboard.worklogsTable.removeProcesses')}
              >
                <ProcessesIcon width={20} height={20} />
              </Button>
            </span>
          </Tooltip>
        )}
      </Flex>
      <Flex gap="3">
        <Button
          color="neutral"
          variant="soft"
          size="l"
          disabled={isPending}
          onClick={onDiscard}
        >
          {t('dashboard.worklogsTable.dialog.discard')}
        </Button>
        <Button
          size="l"
          disabled={isPending || !canSave}
          loading={isSaving}
          onClick={onSave}
        >
          {t('common.save')}
        </Button>
      </Flex>
    </Flex>
  )
}
