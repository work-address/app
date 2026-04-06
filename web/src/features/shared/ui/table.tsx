/* eslint-disable @typescript-eslint/no-explicit-any */

import { Grid, Flex, Checkbox } from '@radix-ui/themes'
import { type ReactNode, useMemo } from 'react'
import styled from 'styled-components'

import { Card } from './card'
import { Text } from './text'

export type TableProps<T extends Record<string, any>> = {
  data: T[]
  config: TableColumnConfig<T>[]
  getRowKey: (data: T) => string | number
  verticalAlign?: 'center' | 'start' | 'end'
  HeaderCellComponent?: (data: TableColumnConfig<T>) => ReactNode
  BodyCellComponent?: (props: CellRenderProps<T>) => ReactNode
  allowSelection?: boolean
}

export type TableColumnConfig<T extends Record<string, any>> = {
  dataKey: keyof T
  width?: string
  headerText?: string
}

export type CellRenderProps<T extends Record<string, any>> = {
  data: T
  columnConfig: TableColumnConfig<T>
}

export const Table = <T extends Record<string, any>>({
  data,
  config,
  getRowKey,
  verticalAlign,
  allowSelection,
  HeaderCellComponent,
  BodyCellComponent,
}: TableProps<T>) => {
  const gridTemplateColumns = useMemo(
    () => config.map(({ width }) => width || '1fr').join(' '),
    [config],
  )

  return (
    <TableCard>
      <Grid>
        <HeaderGrid columns={{ initial: gridTemplateColumns }}>
          {config.map((configEntry, index) => (
            <HeaderCell key={configEntry.dataKey.toString()}>
              <Flex gap={'3'} align={'center'}>
                {allowSelection && index === 0 && <Checkbox />}

                {HeaderCellComponent ? (
                  <HeaderCellComponent {...configEntry} />
                ) : (
                  <Text color={'gray'}>{configEntry.headerText}</Text>
                )}
              </Flex>
            </HeaderCell>
          ))}
        </HeaderGrid>

        <div>
          {data.map((row) => (
            <BodyRowGrid
              key={getRowKey(row)}
              columns={{ initial: gridTemplateColumns }}
            >
              {config.map((columnConfig, index) => {
                return (
                  <BodyCell
                    key={`${columnConfig.dataKey.toString()}-${getRowKey(row)}`}
                    align={verticalAlign}
                  >
                    <Flex gap={'3'} align={'center'}>
                      {allowSelection && index === 0 && <Checkbox />}

                      {BodyCellComponent ? (
                        <BodyCellComponent
                          columnConfig={columnConfig}
                          data={row}
                        />
                      ) : (
                        String(row[columnConfig.dataKey])
                      )}
                    </Flex>
                  </BodyCell>
                )
              })}
            </BodyRowGrid>
          ))}
        </div>
      </Grid>
    </TableCard>
  )
}

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
  &:last-child ${BodyCell} {
    border-bottom: none;
  }
`
