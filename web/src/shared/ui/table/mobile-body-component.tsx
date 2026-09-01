import { Flex, Grid } from '@radix-ui/themes'

import { Hint } from '../hint'
import { Text } from '../text'

import { normalizeDataKeyToReadableString } from './utils'

import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'
import type { ReactNode } from 'react'

export type MobileBodyRenderProps<T extends AnyRecord> = {
  data: T
  DefaultBodyComponent: typeof MobileBodyComponent<T>
  selected?: boolean
  dataKey?: keyof T
  customKey?: string
  columnConfig: MobileDataTableColumnConfigRecord<T>
}

export const MobileBodyComponent = <T extends AnyRecord>(
  props: MobileBodyRenderProps<T>,
): ReactNode => {
  const dataKey = props.dataKey ? String(props.dataKey) : props.customKey
  // Read off the column config, which is what the table actually passes down.
  // A top-level `description` prop was never supplied, so the hint icon this
  // guards had no way to render.
  const description = props.columnConfig.description

  return (
    <Grid columns={'1fr 1fr'} width={'100%'}>
      <Text color={'gray'} size={'2'} weight={'medium'}>
        <Flex gap={'1'} align={'center'}>
          {props.columnConfig.headerText ??
            normalizeDataKeyToReadableString(dataKey)}
          {description && <Hint content={description} size={13} />}
        </Flex>
      </Text>
      <Text align={'left'} size={'2'} weight={'medium'}>
        {props.columnConfig.getValue
          ? props.columnConfig.getValue(props.data)
          : dataKey
            ? String(props.data[dataKey])
            : props.customKey}
      </Text>
    </Grid>
  )
}
