import { ArrowDownIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import styled from 'styled-components'

import { Button } from '../button'
import { Hint } from '../hint'
import { Text } from '../text'

import { normalizeDataKeyToReadableString } from './utils'

import type { DataTableColumnConfigRecord, AnyRecord } from './types'

export type DesktopHeaderCellRenderProps<T extends AnyRecord> = {
  DefaultHeaderComponent: typeof DesktopHeaderCellComponent<T>
  selected?: 'indeterminate' | boolean
  dataKey?: keyof T
  customKey?: string
  columnConfig: DataTableColumnConfigRecord<T>
  sortParams?: Record<string, 'ASC' | 'DESC'> | null
  onSortChange?: (sort: Record<string, 'ASC' | 'DESC'>) => void
}

export const DesktopHeaderCellComponent = <T extends AnyRecord>(
  props: DesktopHeaderCellRenderProps<T>,
) => {
  const Wrapper = props.columnConfig.sortable ? SortButton : 'div'
  const key = String(props.dataKey ?? props.customKey ?? '')
  const sortKey = props.sortParams?.[key]

  const label = (
    <Wrapper
      {...(Wrapper === SortButton
        ? {
            variant: 'ghost',
            color: 'neutral',
            style: {
              cursor: props.columnConfig.sortable ? 'pointer' : 'default',
            },
            onClick: () => {
              const nextOrder = sortKey === 'ASC' ? 'DESC' : 'ASC'
              props?.onSortChange?.({ [key]: nextOrder })
            },
          }
        : {})}
    >
      <Flex align={'center'} gap={'2'}>
        <Title>
          {props.columnConfig.headerText ??
            normalizeDataKeyToReadableString(
              String(props.dataKey ?? '') || props.customKey,
            )}
        </Title>
        {props.columnConfig.sortable && (
          <>
            {(sortKey === 'ASC' || sortKey === 'DESC') && (
              <>
                <ArrowDownIcon
                  style={{
                    color: 'var(--ui-muted)',
                    transform: sortKey === 'ASC' ? 'rotate(180deg)' : 'none',
                  }}
                />
              </>
            )}
          </>
        )}
      </Flex>
    </Wrapper>
  )

  if (!props.columnConfig.description) {
    return label
  }

  // Outside the sort button, not inside it: a sortable header *is* a button,
  // and the hint is focusable in its own right.
  return (
    <Flex align={'center'} gap={'1'}>
      {label}
      <Hint content={props.columnConfig.description} />
    </Flex>
  )
}

/**
 * A ghost button's own inset would push a sortable title off the column's
 * content edge; an optional hook pulls it back and sets a compact height.
 */
const SortButton = styled(Button)`
  --button-m-height: var(--table-sort-height, 32px);
  --button-m-padding: var(--table-sort-padding, 0 12px);

  margin-inline: var(--table-sort-offset, 0);
`

/**
 * Stated on the title itself: a sortable header wraps it in a ghost Button,
 * which would otherwise hand down its own lighter weight and colour, so
 * sortable and plain titles came out differently.
 */
const Title = styled(Text)`
  font-weight: 500;
  color: var(--ui-ink);
`
