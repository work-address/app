/* eslint-disable @typescript-eslint/no-explicit-any */

import { Flex } from '@radix-ui/themes'
import { type ReactNode, useMemo } from 'react'
import styled from 'styled-components'

import { Card } from './card'
import { Checkbox } from './checkbox'
import { Text } from './text'

export const Table = <T extends Record<string, any>>({
  data,
  config,
  getRowId,
  verticalAlign,
  allowSelection,
  selectedIds,
  onSelectedIdsChange,
  HeaderCellComponent = DefaultHeaderCellComponent,
  BodyCellComponent = DefaultBodyCellComponent,
  nowrap,
}: TableProps<T>) => {
  const normalizedSelectedIds = useMemo(
    () => Object.entries(selectedIds || {}).filter(([_, value]) => value),
    [selectedIds],
  )

  const isPartiallySelected = useMemo(
    () =>
      normalizedSelectedIds.length > 0 &&
      normalizedSelectedIds.length < data.length,
    [normalizedSelectedIds, data],
  )

  const isAllSelected = useMemo(
    () => normalizedSelectedIds.length === data.length,
    [normalizedSelectedIds, data],
  )

  const handleSelectedChange = (id: string) => {
    const newSelected = { ...selectedIds, [id]: !selectedIds?.[id] }
    onSelectedIdsChange?.(newSelected)
  }

  const handleToggleAllSelected = () => {
    const allChecked = normalizedSelectedIds.length === 0

    const newSelectedIds = data.reduce(
      (acc, row) => {
        if (allChecked) {
          acc[getRowId(row)] = allChecked
        }

        return acc
      },
      {} as Record<string, boolean>,
    )

    onSelectedIdsChange?.(newSelectedIds)
  }

  return (
    <TableCard>
      <StyledTable $nowrap={nowrap}>
        <THead>
          <tr>
            {config.map((configEntry, index) => {
              const rowsSelected = isPartiallySelected
                ? 'indeterminate'
                : isAllSelected

              const key =
                'dataKey' in configEntry
                  ? configEntry.dataKey
                  : configEntry.customKey

              return (
                <Th key={key.toString()} width={configEntry.width}>
                  <Flex
                    gap={'3'}
                    align={'center'}
                    justify={configEntry.horizontalAlign}
                  >
                    {allowSelection && index === 0 && (
                      <Checkbox
                        checked={rowsSelected}
                        onCheckedChange={() => handleToggleAllSelected()}
                      />
                    )}
                    <HeaderCellComponent
                      {...configEntry}
                      DefaultHeaderCellComponent={DefaultHeaderCellComponent}
                      selected={rowsSelected}
                    />
                  </Flex>
                </Th>
              )
            })}
          </tr>
        </THead>

        <TBody>
          {data.map((row) => {
            const rowId = getRowId(row)

            return (
              <Tr key={rowId}>
                {config.map((columnConfig, index) => {
                  const selected = selectedIds?.[rowId] ?? false

                  const key =
                    'dataKey' in columnConfig
                      ? columnConfig.dataKey
                      : columnConfig.customKey

                  return (
                    <Td
                      key={`${key.toString()}-${rowId}`}
                      verticalAlign={verticalAlign}
                    >
                      <Flex
                        gap={'3'}
                        align={'center'}
                        justify={columnConfig.horizontalAlign}
                      >
                        {allowSelection && index === 0 && (
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() =>
                              rowId && handleSelectedChange(rowId.toString())
                            }
                          />
                        )}

                        <BodyCellComponent
                          columnConfig={columnConfig}
                          data={row}
                          DefaultBodyCellComponent={DefaultBodyCellComponent}
                          selected={selected}
                          dataKey={
                            'dataKey' in columnConfig
                              ? columnConfig.dataKey
                              : undefined
                          }
                          customKey={
                            'customKey' in columnConfig
                              ? columnConfig.customKey
                              : undefined
                          }
                        />
                      </Flex>
                    </Td>
                  )
                })}
              </Tr>
            )
          })}
        </TBody>
      </StyledTable>
    </TableCard>
  )
}

export type TableProps<T extends Record<string, any>> = {
  data: T[]
  config: TableColumnConfigRecord<T>[]
  getRowId: (data: T) => string | number
  verticalAlign?: 'top' | 'middle' | 'bottom' | 'baseline'
  HeaderCellComponent?: (props: HeaderCellRenderProps<T>) => ReactNode
  BodyCellComponent?: (props: CellRenderProps<T>) => ReactNode
  allowSelection?: boolean
  selectedIds?: Record<string, boolean>
  onSelectedIdsChange?: (data: Record<string, boolean>) => void
  nowrap?: boolean
}

type TableColumnConfigRecord<T extends Record<string, any>> = {
  width?: number
  headerText?: string
  horizontalAlign?: 'start' | 'center' | 'end'
} & (
  | {
      dataKey: keyof T
    }
  | {
      customKey: string
    }
)

export type TableColumnConfig<T extends Record<string, any>> =
  TableColumnConfigRecord<T>[]

export type CellRenderProps<T extends Record<string, any>> = {
  data: T
  dataKey?: keyof T
  customKey?: string
  columnConfig: TableColumnConfigRecord<T>
  DefaultBodyCellComponent: typeof DefaultBodyCellComponent<T>
  selected?: boolean
}

export type HeaderCellRenderProps<T extends Record<string, any>> =
  TableColumnConfigRecord<T> & {
    DefaultHeaderCellComponent: typeof DefaultHeaderCellComponent<T>
    selected?: 'indeterminate' | boolean
  }

const DefaultHeaderCellComponent = <T extends Record<string, any>>(
  props: HeaderCellRenderProps<T>,
) => <Text color={'gray'}>{props.headerText}</Text>

const DefaultBodyCellComponent = <T extends Record<string, any>>(
  props: CellRenderProps<T>,
) => (props.dataKey ? String(props.data[props.dataKey]) : props.customKey)

const TableCard = styled(Card)`
  padding: 0;
  overflow: auto;

  table {
    border-collapse: collapse;
    border-spacing: 0;
  }
`

const StyledTable = styled.table<{ $nowrap?: boolean }>`
  min-width: 100%;
  ${(p) => p.$nowrap && `white-space: nowrap;`}
`

const Th = styled.td<{ width?: number }>`
  background: var(--ds-neutral-2);
  padding: 12px var(--space-3);
  font-size: 14px;
  font-weight: 500;

  ${(p) => p.width && `width: ${p.width}px;`}
`

const THead = styled.thead`
  ${Th}:first-child {
    border-top-left-radius: 8px;
  }

  ${Th}:last-child {
    border-top-right-radius: 8px;
  }

  border-bottom: 1px solid var(--ds-neutral-alpha-6);
`

const TBody = styled.tbody``

const Td = styled.td<{ verticalAlign?: TableProps<never>['verticalAlign'] }>`
  padding: var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);

  ${(p) => p.verticalAlign && `vertical-align: ${p.verticalAlign};`}
`

const Tr = styled.tr`
  transition: 0.25s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &:last-child ${Td} {
    border-bottom: none;
  }
`
