import { Flex } from '@radix-ui/themes'
import { type ReactNode } from 'react'
import styled from 'styled-components'

import { Card } from '../card.tsx'
import { Checkbox } from '../checkbox.tsx'

import {
  type DesktopBodyCellRenderProps,
  DesktopBodyCellComponent,
} from './desktop-body-cell-component.tsx'
import {
  DesktopHeaderCellComponent,
  type DesktopHeaderCellRenderProps,
} from './desktop-header-cell.component.tsx'
import { useSelection } from './use-selection.ts'

import type { DataProps, DataTableConfig, AnyRecord } from './types'

export type DataTableProps<T extends AnyRecord> = {
  nowrap?: boolean
  height?: string
  verticalAlign?: 'top' | 'middle' | 'bottom' | 'baseline'
  config: DataTableConfig<T>
  minHeight?: string
  HeaderComponent?: (props: DesktopHeaderCellRenderProps<T>) => ReactNode
  BodyComponent?: (props: DesktopBodyCellRenderProps<T>) => ReactNode
} & DataProps<T>

export const DataTable = <T extends AnyRecord>(props: DataTableProps<T>) => {
  const {
    data,
    config,
    getRowId,
    verticalAlign,
    allowSelection,
    HeaderComponent = DesktopHeaderCellComponent,
    BodyComponent = DesktopBodyCellComponent,
    nowrap,
    minHeight,
    height,
  } = props

  const selectedIds = 'selectedIds' in props ? props.selectedIds : undefined
  const onSelectedIdsChange =
    'onSelectedIdsChange' in props ? props.onSelectedIdsChange : undefined

  const {
    isPartiallySelected,
    isAllSelected,
    handleSelectedChange,
    handleToggleAllSelected,
  } = useSelection({
    data,
    getRowId,
    onSelectedIdsChange,
    selectedIds,
  })

  return (
    <TableCard $height={height} $minHeight={minHeight}>
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
                <Th key={key.toString()} $width={configEntry.width}>
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
                    <HeaderComponent
                      {...configEntry}
                      DefaultHeaderComponent={DesktopHeaderCellComponent}
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
                      $verticalAlign={verticalAlign}
                      $width={columnConfig.width}
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

                        <BodyComponent
                          columnConfig={columnConfig}
                          data={row}
                          DefaultBodyComponent={DesktopBodyCellComponent}
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

const TableCard = styled(Card)<{
  $height: DataTableProps<never>['height']
  $minHeight: DataTableProps<never>['minHeight']
}>`
  padding: 0;
  overflow: auto;

  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  ${(p) => p.$height && `height: ${p.$height};`}
  ${(p) => p.$minHeight && `min-height: ${p.$minHeight};`}
`

const StyledTable = styled.table<{ $nowrap?: boolean }>`
  table-layout: fixed;
  min-width: 100%;
  ${(p) => p.$nowrap && `white-space: nowrap;`}
`

const Th = styled.td<{ $width?: number }>`
  background: var(--ds-neutral-2);
  padding: 12px var(--space-3);
  font-size: 14px;
  font-weight: 500;

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}
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

const Td = styled.td<{
  $verticalAlign?: DataTableProps<never>['verticalAlign']
  $width?: number
}>`
  padding: var(--space-4) var(--space-3);

  ${(p) => p.$verticalAlign && `vertical-align: ${p.$verticalAlign};`}

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}
`

const Tr = styled.tr`
  transition: 0.25s;

  &:not(:last-child) {
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
`

export type { DataTableConfig } from './types'
export { type DesktopBodyCellRenderProps } from './desktop-body-cell-component.tsx'
export { type DesktopHeaderCellRenderProps } from './desktop-header-cell.component.tsx'
