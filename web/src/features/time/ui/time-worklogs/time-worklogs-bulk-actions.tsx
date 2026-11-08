import { TrashIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeBulkPending,
  $selectedTimeCount,
  $selectedTimeProjectId,
  $selectionHasInvoiced,
  timeBulkActionRequested,
  timeBulkSelectionClearRequested,
} from '../../model'

import { Button, Tooltip } from '@/shared'

const TRASH_ICON_SIZE = 12

/** Acts on the current selection, whichever view made it. */
export const TimeWorklogsBulkActions = () => {
  const { t } = useTranslation()

  const {
    selectedCount,
    selectedProjectId,
    hasInvoiced,
    isBulkPending,
    request,
    clearSelection,
  } = useUnit({
    selectedCount: $selectedTimeCount,
    selectedProjectId: $selectedTimeProjectId,
    hasInvoiced: $selectionHasInvoiced,
    isBulkPending: $isTimeBulkPending,
    request: timeBulkActionRequested,
    clearSelection: timeBulkSelectionClearRequested,
  })

  return (
    <Root>
      <Count role="status">
        {t('dashboard.worklogsTable.bulk.selectedCount', {
          count: selectedCount,
        })}
      </Count>
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
      <Tooltip
        content={
          hasInvoiced
            ? t('dashboard.worklogsTable.bulk.invoicedHint')
            : undefined
        }
      >
        <span>
          <Button
            color="danger"
            variant="outline"
            size="s"
            type="button"
            iconLeft={
              <TrashIcon width={TRASH_ICON_SIZE} height={TRASH_ICON_SIZE} />
            }
            disabled={isBulkPending || hasInvoiced}
            onClick={() => request('delete')}
          >
            {t('dashboard.worklogsTable.bulk.delete')}
          </Button>
        </span>
      </Tooltip>
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

/* A quiet strip under the filters while something is selected. */
const Root = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  overflow-x: auto;
`

const Count = styled.span`
  margin-inline-end: var(--ui-space-2);
  color: var(--ui-ink);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`
