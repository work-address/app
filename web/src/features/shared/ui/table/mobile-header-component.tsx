import { normalizeDataKeyToReadableString } from './utils.ts'

import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'

import { Text } from '@/features/shared'

export type MobileHeaderRenderProps<T extends AnyRecord> = Omit<
  MobileDataTableColumnConfigRecord<T>,
  'dataKey' | 'customKey'
> & {
  DefaultHeaderCellComponent: typeof MobileHeaderComponent<T>
  selected?: 'indeterminate' | boolean
  dataKey?: keyof T
  customKey?: string
  data: T
}

export const MobileHeaderComponent = <T extends AnyRecord>(
  props: MobileHeaderRenderProps<T>,
) => (
  <Text size={'4'} weight={'medium'}>
    {props.headerText ??
      props.getValue?.(props.data) ??
      normalizeDataKeyToReadableString(
        String(props.dataKey ? props.data[props.dataKey] : '') ||
          props.customKey,
      )}
  </Text>
)
