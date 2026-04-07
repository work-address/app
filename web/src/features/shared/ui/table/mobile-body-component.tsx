import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'

import { normalizeDataKeyToReadableString } from './utilts'

import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'
import type { ReactNode } from 'react'

import { Text } from '@/features/shared'

export type MobileBodyRenderProps<T extends AnyRecord> = {
  data: T
  dataKey?: keyof T
  customKey?: string
  columnConfig: MobileDataTableColumnConfigRecord<T>
  DefaultBodyComponent: typeof MobileBodyComponent<T>
  selected?: boolean
  description?: string
}

export const MobileBodyComponent = <T extends AnyRecord>(
  props: MobileBodyRenderProps<T>,
): ReactNode => (
  <Grid columns={'1fr 1fr'} width={'100%'}>
    <Text color={'gray'} size={'2'} weight={'medium'}>
      <Flex gap={'1'} align={'center'}>
        {normalizeDataKeyToReadableString(
          String(props.dataKey) || props.customKey,
        )}

        {props.description && <QuestionMarkCircledIcon />}
      </Flex>
    </Text>

    <Text align={'left'} size={'2'} weight={'medium'}>
      {(props.dataKey ? String(props.data[props.dataKey]) : props.customKey) ||
        ''}
    </Text>
  </Grid>
)
