import { TrashIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeBulkPending,
  $selectedTimeCount,
  $selectedTimeProjectId,
  timeBulkActionRequested,
  timeBulkSelectionClearRequested,
} from '../../model'

import { Button, ListPageLayout as S, Tooltip } from '@/shared'

const TRASH_ICON_SIZE = 12

/** Acts on the current selection, whichever view made it. */
export const TimeWorklogsBulkActions = () => {
  const { t } = useTranslation()

  const {
    selectedCount,
    selectedProjectId,
    isBulkPending,
    request,
    clearSelection,
  } = useUnit({
    selectedCount: $selectedTimeCount,
    selectedProjectId: $selectedTimeProjectId,
    isBulkPending: $isTimeBulkPending,
    request: timeBulkActionRequested,
    clearSelection: timeBulkSelectionClearRequested,
  })

  return (
    <Root>
      <S.Label>
        {t('dashboard.worklogsTable.bulk.selectedCount', {
          count: selectedCount,
        })}
      </S.Label>
      <Button
        size="s"
        type="button"
        disabled={isBulkPending}
        onClick={() => request('paid')}
      >
        {t('dashboard.worklogsTable.paymentStatus.paid')}
      </Button>
      <Button
        color="neutral"
        variant="soft"
        size="s"
        type="button"
        disabled={isBulkPending}
        onClick={() => request('unpaid')}
      >
        {t('dashboard.worklogsTable.paymentStatus.unpaid')}
      </Button>
      <Tooltip
        content={t(
          selectedProjectId
            ? 'dashboard.worklogsTable.bulk.invoiceHint'
            : 'dashboard.worklogsTable.bulk.invoiceOneProject',
        )}
      >
        <span>
          <Button
            variant="outline"
            size="s"
            type="button"
            disabled={isBulkPending || !selectedProjectId}
            onClick={() => request('invoice')}
          >
            {t('dashboard.worklogsTable.bulk.invoice')}
          </Button>
        </span>
      </Tooltip>
      <Button
        color="danger"
        variant="outline"
        size="s"
        type="button"
        iconLeft={
          <TrashIcon width={TRASH_ICON_SIZE} height={TRASH_ICON_SIZE} />
        }
        disabled={isBulkPending}
        onClick={() => request('delete')}
      >
        {t('dashboard.worklogsTable.bulk.delete')}
      </Button>
      <Button
        variant="outline"
        color="neutral"
        size="s"
        type="button"
        disabled={isBulkPending}
        onClick={() => clearSelection()}
      >
        {t('dashboard.worklogsTable.bulk.clearSelection')}
      </Button>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
`
