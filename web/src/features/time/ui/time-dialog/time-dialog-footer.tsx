import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { Button, Spinner } from '@/shared'

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
        <Button
          color="red"
          size="3"
          type="button"
          disabled={isPending}
          onClick={onDelete}
        >
          {t('dashboard.worklogsTable.dialog.deleteEntry')}
        </Button>
        {hasScreenshot && (
          <Button
            themeVariant="danger"
            size="3"
            type="button"
            disabled={isPending}
            onClick={onRemoveScreenshot}
          >
            {t('dashboard.worklogsTable.removeScreenshot')}
          </Button>
        )}
        {hasProcesses && (
          <Button
            themeVariant="danger"
            size="3"
            type="button"
            disabled={isPending}
            onClick={onRemoveProcesses}
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
          onClick={onDiscard}
        >
          {t('dashboard.worklogsTable.dialog.discard')}
        </Button>
        <Button
          themeVariant="primary"
          size="3"
          type="button"
          disabled={isPending || !canSave}
          onClick={onSave}
        >
          {isSaving && <Spinner color="#FFF" width="3px" />}
          {t('common.save')}
        </Button>
      </Flex>
    </Flex>
  )
}
