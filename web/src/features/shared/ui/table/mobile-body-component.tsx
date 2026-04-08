import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'

import { normalizeDataKeyToReadableString } from './utils.ts'

import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'
import type { ReactNode } from 'react'

import { Text } from '@/features/shared'

export type MobileBodyRenderProps<T extends AnyRecord> = {
  data: T
  DefaultBodyComponent: typeof MobileBodyComponent<T>
  selected?: boolean
  description?: string
} & MobileDataTableColumnConfigRecord<T>

export const MobileBodyComponent = <T extends AnyRecord>(
  props: MobileBodyRenderProps<T>,
): ReactNode => {
  const dataKey = 'dataKey' in props ? String(props.dataKey) : props.customKey

  return (
    <Grid columns={'1fr 1fr'} width={'100%'}>
      <Text color={'gray'} size={'2'} weight={'medium'}>
        <Flex gap={'1'} align={'center'}>
          {props.headerText ?? normalizeDataKeyToReadableString(dataKey)}
          {props.description && <QuestionMarkCircledIcon />}
        </Flex>
      </Text>

      <Text align={'left'} size={'2'} weight={'medium'}>
        {'dataKey' in props
          ? String(props.data[props.dataKey])
          : props.customKey}
      </Text>
    </Grid>
  )
}
