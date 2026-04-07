import { normalizeDataKeyToReadableString } from './utilts'

import type { DataTableColumnConfigRecord, AnyRecord } from './types'

import { Text } from '@/features/shared'

export type MobileHeaderRenderProps<T extends AnyRecord> =
  DataTableColumnConfigRecord<T> & {
    DefaultHeaderCellComponent: typeof MobileHeaderComponent<T>
    selected?: 'indeterminate' | boolean
    dataKey?: keyof T
    customKey?: string
    data: T
  }

export const MobileHeaderComponent = <T extends AnyRecord>(
  props: MobileHeaderRenderProps<T>,
) => (
  <Text color={'gray'}>
    {props.headerText ??
      normalizeDataKeyToReadableString(
        String(props.dataKey ? props.data[props.dataKey] : '') ||
          props.customKey,
      )}
  </Text>
)
