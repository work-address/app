import { Flex, Skeleton } from '@radix-ui/themes'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'

import { Card } from '../card.tsx'
import { Checkbox } from '../checkbox.tsx'
import { Spinner } from '../spinner-ring.tsx'

import {
  type DesktopBodyCellRenderProps,
  DesktopBodyCellComponent,
} from './desktop-body-cell-component.tsx'
import {
  DesktopHeaderCellComponent,
  type DesktopHeaderCellRenderProps,
} from './desktop-header-cell.component.tsx'
import { useSelection } from './use-selection.ts'
import { MOCK_DATA_LENGTH } from './utils.ts'

import type { DataProps, DataTableConfig, AnyRecord } from './types'

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
} & DataProps<T>

const DEFAULT_SKELETON_HEIGHT = '30px'
const REACH_END_THRESHOLD_PX = 120

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
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onReachEndRef = useRef(onReachEnd)

  useEffect(() => {
    onReachEndRef.current = onReachEnd
  })

  const hasReachEndHandler = Boolean(onReachEnd)

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current

    if (!hasReachEndHandler || !root || !sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReachEndRef.current?.()
        }
      },
      { root, rootMargin: `0px 0px ${REACH_END_THRESHOLD_PX}px 0px` },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
    // Re-observing after each appended page re-reports the current
    // intersection, so a page shorter than the root margin still asks for the
    // next one. Deliberately not keyed on the loading flag: a failed request
    // must not re-trigger by itself, the user retries by scrolling.
  }, [hasReachEndHandler, data.length])

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
      $isFiltering={isFiltering}
    >
      <TableScroll ref={scrollRef}>
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
                  <HeaderTd
                    key={key.toString()}
                    $width={configEntry.width}
                    $sticky={configEntry.sticky}
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
              data.map((row) => {
                const rowId = getRowId(row)

                return (
                  <Tr
                    key={rowId}
                    $clickable={Boolean(onRowClick)}
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
                          $verticalAlign={verticalAlign}
                          $width={columnConfig.width}
                          $sticky={columnConfig.sticky}
                        >
                          <Flex
                            gap={'3'}
                            align={'center'}
                            justify={columnConfig.horizontalAlign}
                          >
                            {allowSelection && index === 0 && (
                              <div onClick={(event) => event.stopPropagation()}>
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
                )
              })}
            {!isDataExists &&
              loading &&
              mockedData.map((_, index) => (
                <Tr key={`loading-${index}`} $clickable={false}>
                  {config.map((columnConfig, index) => (
                    <Td
                      key={`loading-${index}`}
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
        </StyledTable>
        {isLoadingMore && (
          <LoadingMoreRow>
            <Spinner />
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
  $isFiltering?: boolean
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
    display: ${(p) => (p.$isFiltering ? 'block' : 'none')};
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
`

const TableScroll = styled.div`
  overflow: auto;
  flex: 1;
  min-height: 0;
`

const StyledTable = styled.table<{ $nowrap?: boolean }>`
  table-layout: fixed;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;

  ${(p) => p.$nowrap && `white-space: nowrap;`}
`

type StickyPositionProp = 'left' | 'right'

const getStickyProperties = (position?: StickyPositionProp, bg?: string) => {
  if (!position) {
    return ''
  }

  const positionStyle = `${position}: 0;`

  return `
    ${positionStyle}
    position: sticky;
    ${bg ? `background: ${bg};` : ''}
  `
}

const HeaderTd = styled.td<{ $width?: number; $sticky?: StickyPositionProp }>`
  background: var(--ds-neutral-2);
  padding: 12px var(--space-3);
  font-size: 14px;
  font-weight: 500;
  position: sticky;
  top: 0;
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
  z-index: 1;

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}

  ${(p) => getStickyProperties(p.$sticky)}
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

const Td = styled.td<{
  $verticalAlign?: DataTableProps<never>['verticalAlign']
  $width?: number
  $sticky?: StickyPositionProp
}>`
  padding: var(--space-4) var(--space-3);

  ${(p) => p.$verticalAlign && `vertical-align: ${p.$verticalAlign};`}

  ${(p) => p.$width && `width: ${p.$width}px; min-width: ${p.$width}px;`}

  ${(p) => getStickyProperties(p.$sticky, 'var(--white)')}
`

const Tr = styled.tr<{ $clickable: boolean }>`
  transition: 0.25s;

  ${(p) => p.$clickable && 'cursor: pointer;'}

  &:not(:last-child) {
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  &:hover ${Td} {
    background-color: rgb(242, 242, 242);
  }
`

const ReachEndSentinel = styled.div`
  height: 1px;
`

const LoadingMoreRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-3);
`

export type { DataTableConfig } from './types'
export { type DesktopBodyCellRenderProps } from './desktop-body-cell-component.tsx'
export { type DesktopHeaderCellRenderProps } from './desktop-header-cell.component.tsx'
