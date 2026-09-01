import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

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
    <Root>
      <DangerActions>
        <Button color="danger" disabled={isPending} onClick={onDelete}>
          {t('dashboard.worklogsTable.dialog.deleteEntry')}
        </Button>
        {hasScreenshot && (
          <Tooltip content={t('dashboard.worklogsTable.removeScreenshot')}>
            <Button
              color="danger"
              variant="soft"
              disabled={isPending}
              onClick={onRemoveScreenshot}
              aria-label={t('dashboard.worklogsTable.removeScreenshot')}
            >
              <ScreenshotsIcon width={16} height={16} />
            </Button>
          </Tooltip>
        )}
        {hasProcesses && (
          <Tooltip content={t('dashboard.worklogsTable.removeProcesses')}>
            <Button
              color="danger"
              variant="soft"
              disabled={isPending}
              onClick={onRemoveProcesses}
              aria-label={t('dashboard.worklogsTable.removeProcesses')}
            >
              <ProcessesIcon width={16} height={16} />
            </Button>
          </Tooltip>
        )}
      </DangerActions>
      <PrimaryActions>
        <Button
          color="neutral"
          variant="soft"
          disabled={isPending}
          onClick={onDiscard}
        >
          {t('dashboard.worklogsTable.dialog.discard')}
        </Button>
        <Button
          disabled={isPending || !canSave}
          loading={isSaving}
          onClick={onSave}
        >
          {t('common.save')}
        </Button>
      </PrimaryActions>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
    align-items: stretch;
  }
`

const DangerActions = styled.div`
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-wrap: nowrap;

    & > :first-child {
      flex: 1;
      min-width: 0;
    }
  }
`

const PrimaryActions = styled.div`
  display: flex;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    & > * {
      flex: 1;
    }
  }
`
