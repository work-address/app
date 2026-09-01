import { Flex, Skeleton } from '@radix-ui/themes'
import { Fragment, useMemo, useRef, type ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'

import { useReachEnd } from '../../hooks/use-reach-end'
import { Card } from '../card'
import { Checkbox } from '../checkbox'
import { Spinner } from '../spinner-ring'

import {
  type DesktopBodyCellRenderProps,
  DesktopBodyCellComponent,
} from './desktop-body-cell-component'
import {
  DesktopHeaderCellComponent,
  type DesktopHeaderCellRenderProps,
} from './desktop-header-cell.component'
import { useSelection } from './use-selection'
import { MOCK_DATA_LENGTH } from './utils'

import type { DataProps, DataTableConfig, AnyRecord } from './types'

const DEFAULT_SKELETON_HEIGHT = '30px'

export type DataTableProps<T extends AnyRecord> = {
  nowrap?: boolean
  height?: string
  verticalAlign?: 'top' | 'middle' | 'bottom' | 'baseline'
  config: DataTableConfig<T>
  minHeight?: string
  maxHeight?: string
  className?: string
  HeaderComponent?: (props: DesktopHeaderCellRenderProps<T>) => ReactNode
  BodyComponent?: (props: DesktopBodyCellRenderProps<T>) => ReactNode
  skeletonHeight?: string
  sort?: Record<string, 'ASC' | 'DESC'>
  onSortChange?: (sort: Record<string, 'ASC' | 'DESC'>) => void
  onRowClick?: (row: T, action: 'Edit' | 'Delete') => void
  onReachEnd?: () => void
  isLoadingMore?: boolean
  /**
   * Draws a heading row wherever this key changes between neighbouring rows.
   *
   * Grouping stays inside the one table rather than becoming a table per
   * group, so every group keeps the same column widths and the header stays
   * sticky over all of them. Needs `renderGroupHeader` to have any effect.
   */
  getGroupKey?: (row: T) => string
  renderGroupHeader?: (groupKey: string) => ReactNode
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
    maxHeight,
    height,
    loading,
    isFiltering,
    mockDataLength = MOCK_DATA_LENGTH,
    skeletonHeight,
    sort,
    onSortChange,
    onRowClick,
    onReachEnd,
    isLoadingMore,
    className,
    getGroupKey,
    renderGroupHeader,
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)

  const hasReachEndHandler = Boolean(onReachEnd)

  /**
   * Whether the table scrolls its own rows rather than growing with them.
   *
   * Only a height cap makes the body taller than the card, so without one the
   * card grows with every appended page and the page is what scrolls - which
   * is also the scrollport the sentinel then has to be watched against.
   */
  const isSelfScrolling = Boolean(height || maxHeight)

  const sentinelRef = useReachEnd({
    onReachEnd,
    rootRef: isSelfScrolling ? scrollRef : undefined,
    resetKey: data.length,
  })

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

  const mockedData = useMemo(
    () =>
      data.length === 0 && loading
        ? Array.from({ length: mockDataLength })
        : [],
    [data.length, loading, mockDataLength],
  )

  const sortParams = useMemo(() => {
    if (!sort) {
      return null
    }

    return sort
  }, [sort])

  const isDataExists = data.length > 0

  return (
    <TableCard
      className={className}
      $height={height}
      $minHeight={minHeight}
      $maxHeight={maxHeight}
      data-filtering={isFiltering || undefined}
    >
      <TableScroll ref={scrollRef}>
        <Root data-nowrap={nowrap || undefined}>
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
                  <HeaderTd
                    key={key.toString()}
                    $width={configEntry.width}
                    $truncate={configEntry.truncate}
                    data-sticky={configEntry.sticky}
                  >
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
                        columnConfig={configEntry}
                        DefaultHeaderComponent={DesktopHeaderCellComponent}
                        selected={rowsSelected}
                        sortParams={sortParams}
                        dataKey={
                          'dataKey' in configEntry
                            ? configEntry.dataKey
                            : undefined
                        }
                        customKey={
                          'customKey' in configEntry
                            ? configEntry.customKey
                            : undefined
                        }
                        onSortChange={onSortChange}
                      />
                    </Flex>
                  </HeaderTd>
                )
              })}
            </tr>
          </THead>
          <TBody>
            {isDataExists &&
              data.map((row, rowIndex) => {
                const rowId = getRowId(row)

                const groupKey = getGroupKey?.(row)
                const startsGroup =
                  groupKey != null &&
                  Boolean(renderGroupHeader) &&
                  (rowIndex === 0 ||
                    getGroupKey?.(data[rowIndex - 1]) !== groupKey)

                return (
                  <Fragment key={rowId}>
                    {startsGroup && (
                      <GroupTr>
                        <GroupTd colSpan={config.length}>
                          {renderGroupHeader?.(groupKey)}
                        </GroupTd>
                      </GroupTr>
                    )}
                    <Tr
                      data-clickable={Boolean(onRowClick) || undefined}
                      onClick={
                        onRowClick ? () => onRowClick(row, 'Edit') : undefined
                      }
                    >
                      {config.map((columnConfig, index) => {
                        const selected = selectedIds?.[rowId] ?? false

                        const key =
                          'dataKey' in columnConfig
                            ? columnConfig.dataKey
                            : columnConfig.customKey

                        return (
                          <Td
                            key={`${key.toString()}-${rowId}`}
                            data-vertical-align={verticalAlign}
                            $width={columnConfig.width}
                            $truncate={columnConfig.truncate}
                            data-sticky={columnConfig.sticky}
                          >
                            <Flex
                              gap={'3'}
                              align={'center'}
                              justify={columnConfig.horizontalAlign}
                            >
                              {allowSelection && index === 0 && (
                                <div
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={() =>
                                      rowId &&
                                      handleSelectedChange(rowId.toString())
                                    }
                                  />
                                </div>
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
                  </Fragment>
                )
              })}
            {!isDataExists &&
              loading &&
              mockedData.map((_, index) => (
                <Tr key={`loading-${index}`}>
                  {config.map((columnConfig, index) => (
                    <Td
                      key={`loading-${index}`}
                      data-vertical-align={verticalAlign}
                      $width={columnConfig.width}
                    >
                      <Flex
                        gap={'3'}
                        align={'center'}
                        justify={columnConfig.horizontalAlign}
                      >
                        {allowSelection && index === 0 && (
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => {}}
                          />
                        )}
                        <Skeleton
                          height={skeletonHeight ?? DEFAULT_SKELETON_HEIGHT}
                          width="100%"
                        />
                      </Flex>
                    </Td>
                  ))}
                </Tr>
              ))}
          </TBody>
        </Root>
        {isLoadingMore && (
          <LoadingMoreRow>
            <Spinner size={32} />
          </LoadingMoreRow>
        )}
        {hasReachEndHandler && <ReachEndSentinel ref={sentinelRef} />}
      </TableScroll>
    </TableCard>
  )
}

const pulseAnimation = keyframes`
  0% {
    offset-distance: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    offset-distance: 100%;
    opacity: 0;
  }
`

const TableCard = styled(Card)<{
  $height: DataTableProps<never>['height']
  $minHeight: DataTableProps<never>['minHeight']
  $maxHeight: DataTableProps<never>['maxHeight']
}>`
  padding: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  ${(p) => p.$height && `height: ${p.$height};`}
  ${(p) => p.$minHeight && `min-height: ${p.$minHeight};`}
  ${(p) => p.$maxHeight && `max-height: ${p.$maxHeight};`}

  &::before {
    content: '';
    display: none;
    position: absolute;
    width: 120px;
    height: 4px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--ds-accent-9),
      transparent
    );
    filter: blur(1px);
    z-index: 10;
    pointer-events: none;
    offset-path: rect(0% 100% 100% 0% round var(--radius-4));
    animation: ${pulseAnimation} 2s ease-in-out infinite;
  }

  &[data-filtering]::before {
    display: block;
  }
`

const TableScroll = styled.div`
  overflow: auto;
  flex: 1;
  min-height: 0;
`

const Root = styled.table`
  table-layout: fixed;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;

  &[data-nowrap] {
    white-space: nowrap;
  }
`

const HeaderTd = styled.td<{ $width?: number; $truncate?: boolean }>`
  background: var(--ds-neutral-2);
  padding: 12px var(--space-3);
  font-size: var(--font-size-2);
  font-weight: 500;
  position: sticky;
  top: 0;
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
  z-index: 1;

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}
  ${(p) => p.$truncate && p.$width && `max-width: ${p.$width}px;`}

  &[data-sticky='left'] {
    left: 0;
  }

  &[data-sticky='right'] {
    right: 0;
  }
`

const THead = styled.thead`
  ${HeaderTd}:first-child {
    border-top-left-radius: 8px;
  }

  ${HeaderTd}:last-child {
    border-top-right-radius: 8px;
  }

  border-bottom: 1px solid var(--ds-neutral-alpha-6);
`

const TBody = styled.tbody``

const Td = styled.td<{ $width?: number; $truncate?: boolean }>`
  padding: var(--space-4) var(--space-3);

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}
  ${(p) => p.$truncate && p.$width && `max-width: ${p.$width}px;`}

  &[data-vertical-align='top'] {
    vertical-align: top;
  }

  &[data-vertical-align='middle'] {
    vertical-align: middle;
  }

  &[data-vertical-align='bottom'] {
    vertical-align: bottom;
  }

  &[data-vertical-align='baseline'] {
    vertical-align: baseline;
  }

  &[data-sticky='left'] {
    position: sticky;
    left: 0;
    background: var(--white);
  }

  &[data-sticky='right'] {
    position: sticky;
    right: 0;
    background: var(--white);
  }
`

const Tr = styled.tr`
  transition: 0.25s;

  &:not(:last-child) {
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  &:hover ${Td} {
    background-color: var(--c-f2f2f2);
  }

  &[data-clickable] {
    cursor: pointer;
  }
`

const GroupTr = styled.tr``

const GroupTd = styled.td`
  padding: var(--space-5) var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
  background: var(--white);

  ${GroupTr}:first-child & {
    padding-top: var(--space-3);
  }
`

const LoadingMoreRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6) var(--space-3);
`

const ReachEndSentinel = styled.div`
  height: 1px;
`

export type { DataTableConfig } from './types'
export { type DesktopBodyCellRenderProps } from './desktop-body-cell-component'
export { type DesktopHeaderCellRenderProps } from './desktop-header-cell.component'
