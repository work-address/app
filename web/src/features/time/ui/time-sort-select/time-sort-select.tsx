import { ArrowDownIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import { DropdownMenu } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  getTimeSortField,
  getTimeSortOrder,
  TIME_SORT_FIELDS,
  toTimeSort,
  type TimeSortField,
} from '../../model'
import { ToolbarSegment, ToolbarShell } from '../common'

import { $timeSort, resetTimeSort } from '@/entities/time'

const ICON_SIZE = 14

/**
 * Sorting for readers who are not looking at column headers.
 *
 * Writes the same store the table headers do, so the order survives a view
 * switch and the two controls can never disagree about it.
 */
export const TimeSortSelect = ({ className }: { className?: string }) => {
  const { t } = useTranslation()

  const { sort, setSort } = useUnit({
    sort: $timeSort,
    setSort: resetTimeSort,
  })

  const field = getTimeSortField(sort)
  const order = getTimeSortOrder(sort)

  const options = useMemo(
    () =>
      TIME_SORT_FIELDS.map((entry) => ({
        value: entry.field,
        label: t(entry.labelKey),
      })),
    [t],
  )

  const activeLabel = options.find((option) => option.value === field)?.label

  return (
    <Root className={className} aria-label={t('dashboard.worklogsSort.label')}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Field type="button">
            <Label>{t('dashboard.worklogsSort.label')}</Label>
            {activeLabel}
            <ChevronDownIcon width={ICON_SIZE} height={ICON_SIZE} />
          </Field>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content size="1" variant="soft">
          <DropdownMenu.RadioGroup
            value={field}
            onValueChange={(value) =>
              setSort(toTimeSort(value as TimeSortField, order))
            }
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Direction
        type="button"
        data-order={order.toLowerCase()}
        aria-label={t(
          order === 'ASC'
            ? 'dashboard.worklogsSort.toDescending'
            : 'dashboard.worklogsSort.toAscending',
        )}
        onClick={() =>
          setSort(toTimeSort(field, order === 'ASC' ? 'DESC' : 'ASC'))
        }
      >
        <ArrowDownIcon width={ICON_SIZE} height={ICON_SIZE} />
      </Direction>
    </Root>
  )
}

const Root = styled(ToolbarShell).attrs({ role: 'group' })``

const Field = styled(ToolbarSegment)`
  color: var(--ds-neutral-12);
`

const Label = styled.span`
  color: var(--ds-neutral-11);
`

const Direction = styled(ToolbarSegment)`
  padding-inline: var(--space-2);

  & svg {
    transition: transform 0.15s;
  }

  &[data-order='asc'] svg {
    transform: rotate(180deg);
  }
`
