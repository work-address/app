import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeBulkPending,
  $selectedTimeCount,
  $selectedTimeProjectId,
  $selectionHasInvoiced,
  timeBulkActionRequested,
  timeBulkSelectionClearRequested,
  type TimeBulkAction,
} from '../../model'

import { Button, Select, Text } from '@/shared'

/** Every presentation acts on the same selection and model workflow. */
export const TimeMobileBulkActions = () => {
  const { t } = useTranslation()
  const [action, setAction] = useState<TimeBulkAction | ''>('')
  const { selectedCount, projectId, hasInvoiced, busy, request, clear } =
    useUnit({
      selectedCount: $selectedTimeCount,
      projectId: $selectedTimeProjectId,
      hasInvoiced: $selectionHasInvoiced,
      busy: $isTimeBulkPending,
      request: timeBulkActionRequested,
      clear: timeBulkSelectionClearRequested,
    })
  const invalidInvoice = action === 'invoice' && !projectId
  const refusedInvoiced =
    hasInvoiced &&
    (action === 'delete' ||
      action === 'remove-screenshots' ||
      action === 'remove-processes')
  const options = [
    { value: 'paid', label: t('dashboard.worklogsTable.paymentStatus.paid') },
    {
      value: 'unpaid',
      label: t('dashboard.worklogsTable.paymentStatus.unpaid'),
    },
    { value: 'invoice', label: t('dashboard.worklogsTable.bulk.invoice') },
    { value: 'delete', label: t('dashboard.worklogsTable.bulk.delete') },
    {
      value: 'remove-screenshots',
      label: t('dashboard.worklogsTable.removeScreenshot'),
    },
    {
      value: 'remove-processes',
      label: t('dashboard.worklogsTable.removeProcesses'),
    },
  ] satisfies { value: TimeBulkAction; label: string }[]

  return (
    <Root aria-busy={busy || undefined}>
      {/* The count and its undo on one line, then the action and its
          trigger on the next: two rows rather than four. */}
      <Head>
        <Text size="2" weight="medium">
          {t('dashboard.worklogsTable.bulk.selectedCount', {
            count: selectedCount,
          })}
        </Text>
        <Button
          size="s"
          variant="ghost"
          color="neutral"
          disabled={busy}
          onClick={clear}
        >
          {t('dashboard.worklogsTable.bulk.clearSelection')}
        </Button>
      </Head>
      <Actions>
        <Select
          options={options}
          value={action}
          onChange={(value) => {
            if (
              !Array.isArray(value) &&
              options.some((option) => option.value === value)
            ) {
              setAction(value as TimeBulkAction)
            }
          }}
          inputProps={{
            disabled: busy,
            'aria-label': t('dashboard.worklogsTable.bulk.actionPlaceholder'),
          }}
          placeholder={t('dashboard.worklogsTable.bulk.actionPlaceholder')}
        />
        <Button
          disabled={
            !action ||
            busy ||
            invalidInvoice ||
            refusedInvoiced ||
            selectedCount === 0
          }
          onClick={() => action && request(action)}
        >
          {t('common.apply')}
        </Button>
      </Actions>
      {invalidInvoice && (
        <Hint role="status">
          {t('dashboard.worklogsTable.bulk.invoiceOneProject')}
        </Hint>
      )}
      {refusedInvoiced && (
        <Hint role="status">
          {t('dashboard.worklogsTable.bulk.invoicedHint')}
        </Hint>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  width: 100%;
  padding: var(--ui-space-3);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
`

const Hint = styled.p`
  margin: 0;
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
`

const Head = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-2);
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-2);
`
