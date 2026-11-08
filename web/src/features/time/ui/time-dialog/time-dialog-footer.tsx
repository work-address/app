import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProcessesIcon, ScreenshotsIcon, Tooltip, Button } from '@/shared'

type TimeDialogFooterProps = {
  isPending: boolean
  isSaving: boolean
  canSave: boolean
  hasScreenshot: boolean
  hasProcesses: boolean
  /** The reader may delete it and remove what it recorded. */
  canRemove: boolean
  /** The reader may save a change to it; if not, only closing is offered. */
  canEdit: boolean
  isInvoiced: boolean
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
  canRemove,
  canEdit,
  isInvoiced,
  onDelete,
  onRemoveScreenshot,
  onRemoveProcesses,
  onDiscard,
  onSave,
}: TimeDialogFooterProps) => {
  const { t } = useTranslation()

  return (
    <Root>
      {canRemove ? (
        <DangerActions>
          {/* Soft, not solid: Save is the one filled button here. */}
          <Button
            color="danger"
            variant="soft"
            disabled={isPending}
            onClick={onDelete}
          >
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
      ) : (
        canEdit &&
        isInvoiced && (
          <Hint role="note">
            {t('dashboard.worklogsTable.dialog.invoicedHint')}
          </Hint>
        )
      )}
      <PrimaryActions>
        {canEdit ? (
          <>
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
          </>
        ) : (
          <Button color="neutral" variant="soft" onClick={onDiscard}>
            {t('common.close')}
          </Button>
        )}
      </PrimaryActions>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
    align-items: stretch;
  }
`

const DangerActions = styled.div`
  display: flex;
  gap: var(--ui-space-3);
  flex-wrap: wrap;

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-wrap: nowrap;

    & > :first-child {
      flex: 1;
      min-width: 0;
    }
  }
`

const Hint = styled.p`
  min-width: 0;
  margin: 0;
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
`

const PrimaryActions = styled.div`
  display: flex;
  gap: var(--ui-space-3);
  /* Stays on the right when nothing sits on its left. */
  margin-left: auto;

  ${(p) => p.theme.breakpoints.down('md')} {
    & > * {
      flex: 1;
    }
  }
`
