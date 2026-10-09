import { ArrowDownIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'

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
  const Wrapper = props.columnConfig.sortable ? Button : 'div'
  const key = String(props.dataKey ?? props.customKey ?? '')
  const sortKey = props.sortParams?.[key]

  const label = (
    <Wrapper
      {...(Wrapper === Button
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
        <Text color={'gray'}>
          {props.columnConfig.headerText ??
            normalizeDataKeyToReadableString(
              String(props.dataKey ?? '') || props.customKey,
            )}
        </Text>
        {props.columnConfig.sortable && (
          <>
            {(sortKey === 'ASC' || sortKey === 'DESC') && (
              <>
                <ArrowDownIcon
                  style={{
                    color: 'var(--ds-neutral-11)',
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
