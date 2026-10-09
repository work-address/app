import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeBulkPending,
  $selectedTimeCount,
  $selectedTimeProjectId,
  timeBulkActionRequested,
  timeBulkSelectionClearRequested,
  type TimeBulkAction,
} from '../../model'

import { Button, Select, Text } from '@/shared'

/** Every presentation acts on the same selection and model workflow. */
export const TimeMobileBulkActions = () => {
  const { t } = useTranslation()
  const [action, setAction] = useState<TimeBulkAction | ''>('')
  const { selectedCount, projectId, busy, request, clear } = useUnit({
    selectedCount: $selectedTimeCount,
    projectId: $selectedTimeProjectId,
    busy: $isTimeBulkPending,
    request: timeBulkActionRequested,
    clear: timeBulkSelectionClearRequested,
  })
  const invalidInvoice = action === 'invoice' && !projectId
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
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.bulk.selectedCount', {
          count: selectedCount,
        })}
      </Text>
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
      {invalidInvoice && (
        <Hint role="status">
          {t('dashboard.worklogsTable.bulk.invoiceOneProject')}
        </Hint>
      )}
      <Actions>
        <Button
          stretch
          size="l"
          disabled={!action || busy || invalidInvoice || selectedCount === 0}
          onClick={() => action && request(action)}
        >
          {t('common.apply')}
        </Button>
        <Button
          stretch
          size="l"
          variant="outline"
          color="neutral"
          disabled={busy}
          onClick={clear}
        >
          {t('dashboard.worklogsTable.bulk.clearSelection')}
        </Button>
      </Actions>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-2);
  width: 100%;
  margin-bottom: var(--space-3);
`

const Hint = styled.p`
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--ds-neutral-11);
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
`
