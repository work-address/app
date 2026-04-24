import { ArrowDownIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'

import { normalizeDataKeyToReadableString } from './utils.ts'

import type { DataTableColumnConfigRecord, AnyRecord } from './types'

import { Button, Text } from '@/shared'

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

  return (
    <Wrapper
      {...(Wrapper === Button
        ? {
            variant: 'ghost',
            style: {
              cursor: props.columnConfig.sortable ? 'pointer' : 'default',
            },
            color: 'gray',
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
                    fill: '#000',
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
}
