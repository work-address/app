import { Grid, Flex } from '@radix-ui/themes'
import { type ReactNode, useMemo } from 'react'
import styled from 'styled-components'

import { Card } from './card'

export type TableProps<T> = {
  data: T[]
  config: TableColumnConfig<T>[]
  getRowKey: (data: T) => string | number
  verticalAlign?: 'center' | 'start' | 'end'
}

export type TableColumnConfig<T> = {
  dataKey: keyof T
  getHeaderContent: () => ReactNode
  getRowContent?: (data: T) => ReactNode
  width?: string
}

export const Table = <T,>({
  data,
  config,
  getRowKey,
  verticalAlign,
}: TableProps<T>) => {
  const gridTemplateColumns = useMemo(
    () => config.map(({ width }) => width || '1fr').join(' '),
    [config],
  )

  return (
    <TableCard>
      <Grid>
        <HeaderGrid columns={{ initial: gridTemplateColumns }}>
          {config.map(({ dataKey, getHeaderContent }) => (
            <HeaderCell key={dataKey.toString()}>
              {getHeaderContent()}
            </HeaderCell>
          ))}
        </HeaderGrid>

        <div>
          {data.map((row) => (
            <BodyRowGrid
              key={getRowKey(row)}
              columns={{ initial: gridTemplateColumns }}
            >
              {config.map(({ getRowContent, dataKey }) => {
                return (
                  <BodyCell
                    key={`${dataKey.toString()}-${getRowKey(row)}`}
                    align={verticalAlign}
                  >
                    {getRowContent ? getRowContent(row) : String(row[dataKey])}
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
