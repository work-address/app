import { TrashIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeBulkPending,
  $selectedTimeCount,
  $selectedTimeIds,
  $selectionHasInvoicedTime,
  $selectionHasViewerOnlyProject,
  timeBulkDeleteRequested,
  timeBulkPaidStatusRequested,
  timeSelectionCleared,
} from '../../model'

import { $allTime } from '@/entities/time'
import { invoiceSelectedTimeMutation } from '@/features/invoice'
import { Button, ListPageLayout as S, showToast, Tooltip } from '@/shared'

const TRASH_ICON_SIZE = 12

/** Acts on the current selection, whichever view made it. */
export const TimeWorklogsBulkActions = () => {
  const { t } = useTranslation()

  const {
    entries,
    selectedIds,
    selectedCount,
    isBulkPending,
    hasInvoiced,
    hasViewerOnlyProject,
    invoicing,
    invoiceSelected,
    requestBulkDelete,
    requestBulkPaidStatus,
    clearSelection,
  } = useUnit({
    entries: $allTime,
    selectedIds: $selectedTimeIds,
    selectedCount: $selectedTimeCount,
    isBulkPending: $isTimeBulkPending,
    hasInvoiced: $selectionHasInvoicedTime,
    hasViewerOnlyProject: $selectionHasViewerOnlyProject,
    invoicing: invoiceSelectedTimeMutation.$pending,
    invoiceSelected: invoiceSelectedTimeMutation.start,
    requestBulkDelete: timeBulkDeleteRequested,
    requestBulkPaidStatus: timeBulkPaidStatusRequested,
    clearSelection: timeSelectionCleared,
  })

  /**
   * The project the current selection belongs to, or null when it spans more
   * than one.
   *
   * An invoice is per-project by construction - it carries one rate and one
   * counterparty - so a mixed selection has no single answer and the action is
   * refused rather than silently splitting into several invoices.
   */
  const selectedProjectId = useMemo(() => {
    const selected = new Set(selectedIds)
    const projectIds = new Set(
      entries
        .filter((row) => row.id && selected.has(row.id))
        .map((row) => row.project?.id)
        .filter((id): id is string => Boolean(id)),
    )

    return projectIds.size === 1 ? [...projectIds][0] : null
  }, [entries, selectedIds])

  const handleInvoice = () => {
    if (!selectedProjectId) {
      showToast('info', {
        message: t('dashboard.worklogsTable.bulk.invoiceOneProject'),
        position: 'top-center',
      })

      return
    }

    invoiceSelected({ projectId: selectedProjectId, timeIds: selectedIds })
  }

  const paidStatusInvoicedHint = t(
    'dashboard.worklogsTable.bulk.paidStatusInvoicedHint',
  )

  const paidStatusButtons = (
    <>
      <Button
        size="s"
        type="button"
        disabled={isBulkPending || hasInvoiced}
        onClick={() => requestBulkPaidStatus(true)}
      >
        {t('dashboard.worklogsTable.paymentStatus.paid')}
      </Button>
      <Button
        color="neutral"
        variant="soft"
        size="s"
        type="button"
        disabled={isBulkPending || hasInvoiced}
        onClick={() => requestBulkPaidStatus(false)}
      >
        {t('dashboard.worklogsTable.paymentStatus.unpaid')}
      </Button>
    </>
  )

  const deleteInvoicedHint = t(
    'dashboard.worklogsTable.bulk.deleteInvoicedHint',
  )

  const deleteButton = (
    <Button
      color="danger"
      variant="outline"
      size="s"
      type="button"
      iconLeft={<TrashIcon width={TRASH_ICON_SIZE} height={TRASH_ICON_SIZE} />}
      disabled={isBulkPending || hasInvoiced}
      onClick={() => requestBulkDelete(selectedIds)}
    >
      {t('dashboard.worklogsTable.bulk.delete')}
    </Button>
  )

  return (
    <Root>
      <S.Label>
        {t('dashboard.worklogsTable.bulk.selectedCount', {
          count: selectedCount,
        })}
      </S.Label>
      {/* An invoiced entry's payment follows its invoice, and the API refuses
          the whole request if one is selected - so the actions say why they
          are unavailable instead of being offered and refused. A disabled
          button fires no pointer events and takes no focus, so the tooltip
          anchors on the group, which is focusable for keyboard users. */}
      {hasInvoiced ? (
        <Tooltip content={paidStatusInvoicedHint}>
          <ActionGroup
            role="group"
            aria-label={paidStatusInvoicedHint}
            tabIndex={0}
          >
            {paidStatusButtons}
          </ActionGroup>
        </Tooltip>
      ) : (
        <ActionGroup>{paidStatusButtons}</ActionGroup>
      )}
      {/* Not offered at all on a project the user only views, as on the
          projects table: a viewer sees no invoices and may raise none, so
          there is nothing to explain - the action is simply not theirs. */}
      {!hasViewerOnlyProject && (
        <Tooltip content={t('dashboard.worklogsTable.bulk.invoiceHint')}>
          <span>
            <Button
              variant="outline"
              size="s"
              type="button"
              disabled={isBulkPending || invoicing}
              loading={invoicing}
              onClick={handleInvoice}
            >
              {t('dashboard.worklogsTable.bulk.invoice')}
            </Button>
          </span>
        </Tooltip>
      )}
      {/* An invoice keeps the hours it bills, and the API refuses the whole
          delete if one selected entry is on an invoice - so, as with payment,
          the action says why it is unavailable. */}
      {hasInvoiced ? (
        <Tooltip content={deleteInvoicedHint}>
          <ActionGroup
            role="group"
            aria-label={deleteInvoicedHint}
            tabIndex={0}
          >
            {deleteButton}
          </ActionGroup>
        </Tooltip>
      ) : (
        deleteButton
      )}
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

const ActionGroup = styled.span`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2);
`
