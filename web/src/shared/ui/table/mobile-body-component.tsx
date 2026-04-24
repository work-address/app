import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'

import { normalizeDataKeyToReadableString } from './utils.ts'

import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'
import type { ReactNode } from 'react'

import { Text } from '@/shared'

export type MobileBodyRenderProps<T extends AnyRecord> = {
  data: T
  DefaultBodyComponent: typeof MobileBodyComponent<T>
  selected?: boolean
  description?: string
  dataKey?: keyof T
  customKey?: string
  columnConfig: MobileDataTableColumnConfigRecord<T>
}

export const MobileBodyComponent = <T extends AnyRecord>(
  props: MobileBodyRenderProps<T>,
): ReactNode => {
  const dataKey = props.dataKey ? String(props.dataKey) : props.customKey

  return (
    <Grid columns={'1fr 1fr'} width={'100%'}>
      <Text color={'gray'} size={'2'} weight={'medium'}>
        <Flex gap={'1'} align={'center'}>
          {props.columnConfig.headerText ??
            normalizeDataKeyToReadableString(dataKey)}

          {props.description && <QuestionMarkCircledIcon />}
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
