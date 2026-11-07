import { ArrowDownIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import { DropdownMenu } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ToolbarSegment, ToolbarShell } from './toolbar-control'

const ICON_SIZE = 14

export type SortOrder = 'ASC' | 'DESC'

type SortSelectProps<Field extends string> = {
  options: { value: Field; label: string }[]
  field: Field
  order: SortOrder
  onChange: (field: Field, order: SortOrder) => void
  className?: string
}

/**
 * Sorting for readers who are not looking at column headers: a phone's cards
 * have none, and neither does the worklogs grid.
 *
 * Holds no state of its own - the owner passes the same sort its table headers
 * write, so the two controls can never disagree about it.
 */
export const SortSelect = <Field extends string>({
  options,
  field,
  order,
  onChange,
  className,
}: SortSelectProps<Field>) => {
  const { t } = useTranslation()

  const activeLabel = options.find((option) => option.value === field)?.label

  return (
    <Root className={className} aria-label={t('dashboard.worklogsSort.label')}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <SortField type="button">
            <Label>{t('dashboard.worklogsSort.label')}</Label>
            {activeLabel}
            <ChevronDownIcon width={ICON_SIZE} height={ICON_SIZE} />
          </SortField>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content size="1" variant="soft">
          <DropdownMenu.RadioGroup
            value={field}
            onValueChange={(value) => onChange(value as Field, order)}
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
        onClick={() => onChange(field, order === 'ASC' ? 'DESC' : 'ASC')}
      >
        <ArrowDownIcon width={ICON_SIZE} height={ICON_SIZE} />
      </Direction>
    </Root>
  )
}

const Root = styled(ToolbarShell).attrs({ role: 'group' })`
  min-height: var(--sort-select-height, auto);
  border-color: var(--sort-select-border, var(--ui-line));
  border-radius: var(--sort-select-radius, var(--ui-filter-radius));
  background: var(--sort-select-background, var(--ui-inset));
`

const SortField = styled(ToolbarSegment)`
  min-height: var(--sort-select-segment-height, 22px);
  padding-inline: var(--sort-select-padding, var(--ui-space-3));
  border-radius: var(--sort-select-segment-radius, var(--ui-row-radius));
  font-size: var(--sort-select-font-size, var(--ui-small-size));
  color: var(--ui-ink);
`

const Label = styled.span`
  color: var(--ui-muted);
`

const Direction = styled(ToolbarSegment)`
  min-height: var(--sort-select-segment-height, 22px);
  padding-inline: var(--ui-space-2);
  border-radius: var(--sort-select-segment-radius, var(--ui-row-radius));

  & svg {
    transition: transform 0.15s;
  }

  &[data-order='asc'] svg {
    transform: rotate(180deg);
  }
`
