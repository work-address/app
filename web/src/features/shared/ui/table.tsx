/* eslint-disable @typescript-eslint/no-explicit-any */

import { Grid, Flex } from '@radix-ui/themes'
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
}: TableProps<T>) => {
  const gridTemplateColumns = useMemo(
    () => config.map(({ width }) => width || '1fr').join(' '),
    [config],
  )

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
      <Grid>
        <HeaderGrid columns={{ initial: gridTemplateColumns }}>
          {config.map((configEntry, index) => {
            const rowsSelected = isPartiallySelected
              ? 'indeterminate'
              : isAllSelected

            return (
              <HeaderCell key={configEntry.dataKey.toString()}>
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
              </HeaderCell>
            )
          })}
        </HeaderGrid>

        <div>
          {data.map((row) => {
            const rowId = getRowId(row)

            return (
              <BodyRowGrid
                key={rowId}
                columns={{ initial: gridTemplateColumns }}
              >
                {config.map((columnConfig, index) => {
                  const selected = selectedIds?.[rowId] ?? false

                  return (
                    <BodyCell
                      key={`${columnConfig.dataKey.toString()}-${rowId}`}
                      align={verticalAlign}
                      justify={columnConfig.horizontalAlign}
                    >
                      <Flex gap={'3'} align={'center'}>
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
                        />
                      </Flex>
                    </BodyCell>
                  )
                })}
              </BodyRowGrid>
            )
          })}
        </div>
      </Grid>
    </TableCard>
  )
}

export type TableProps<T extends Record<string, any>> = {
  data: T[]
  config: TableColumnConfigRecord<T>[]
  getRowId: (data: T) => string | number
  verticalAlign?: 'center' | 'start' | 'end'
  HeaderCellComponent?: (props: HeaderCellRenderProps<T>) => ReactNode
  BodyCellComponent?: (props: CellRenderProps<T>) => ReactNode
  allowSelection?: boolean
  selectedIds?: Record<string, boolean>
  onSelectedIdsChange?: (data: Record<string, boolean>) => void
}

type TableColumnConfigRecord<T extends Record<string, any>> = {
  dataKey: keyof T
  width?: string
  headerText?: string
  horizontalAlign?: 'start' | 'center' | 'end'
}

export type TableColumnConfig<T extends Record<string, any>> =
  TableColumnConfigRecord<T>[]

export type CellRenderProps<T extends Record<string, any>> = {
  data: T
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
) => String(props.data[props.columnConfig.dataKey])

const TableCard = styled(Card)`
  padding: 0;
`

const HeaderCell = styled.div`
  background: var(--ds-neutral-2);
  padding: 12px var(--space-3);
`

const HeaderGrid = styled(Grid)`
  ${HeaderCell}:first-child {
    border-top-left-radius: 8px;
  }

  ${HeaderCell}:last-child {
    border-top-right-radius: 8px;
  }

  border-bottom: 1px solid var(--ds-neutral-alpha-6);
`

const BodyCell = styled(Flex)`
  padding: var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
`

const BodyRowGrid = styled(Grid)`
  transition: 0.25s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &:last-child ${BodyCell} {
    border-bottom: none;
  }
`
