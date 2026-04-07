import { Fragment, type ReactNode, useMemo } from 'react'
import styled from 'styled-components'

import { MobileBodyComponent } from './mobile-body-component'
import { MobileHeaderComponent } from './mobile-header-component'

import type { MobileBodyRenderProps } from './mobile-body-component'
import type { MobileHeaderRenderProps } from './mobile-header-component'
import type { DataProps, MobileDataTableConfig, AnyRecord } from './types.ts'

export type MobileDataTableProps<T extends AnyRecord> = {
  config: MobileDataTableConfig<T>
  HeaderComponent?: (props: MobileHeaderRenderProps<T>) => ReactNode
  BodyComponent?: (props: MobileBodyRenderProps<T>) => ReactNode
} & DataProps<T>

export const MobileDataTable = <T extends AnyRecord>({
  data,
  HeaderComponent = MobileHeaderComponent,
  BodyComponent = MobileBodyComponent,
  getRowId,
  config,
}: MobileDataTableProps<T>) => {
  const headerConfig = useMemo(
    () => config.find((configItem) => configItem.isTitle),
    [config],
  )

  const configWithoutHeader = useMemo(
    () => config.filter((configItem) => !configItem.isTitle),
    [config],
  )

  if (!headerConfig) {
    throw new Error(
      'You should set "isTitle" prop at least at one item in config.',
    )
  }

  return (
    <Wrapper>
      {data.map((row) => (
        <Fragment key={getRowId(row)}>
          <HeaderComponent
            data={row}
            dataKey={
              'dataKey' in headerConfig
                ? headerConfig.dataKey
                : headerConfig.customKey
            }
            DefaultHeaderCellComponent={MobileHeaderComponent}
          />

          {configWithoutHeader.map((configItem) => (
            <BodyComponent
              key={`${getRowId(row)}-${'dataKey' in configItem ? String(configItem.dataKey) : configItem.customKey}`}
              data={row}
              DefaultBodyComponent={MobileBodyComponent}
              columnConfig={configItem}
              dataKey={'dataKey' in configItem ? configItem.dataKey : undefined}
              customKey={
                'customKey' in configItem ? configItem.customKey : undefined
              }
            />
          ))}
        </Fragment>
      ))}
    </Wrapper>
  )
}

const Wrapper = styled.div``

export { type MobileDataTableConfig } from './types.ts'
