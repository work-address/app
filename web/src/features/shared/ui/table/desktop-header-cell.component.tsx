import { normalizeDataKeyToReadableString } from './utilts'

import type { DataTableColumnConfigRecord, AnyRecord } from './types'

import { Text } from '@/features/shared'

export type DesktopHeaderCellRenderProps<T extends AnyRecord> =
  DataTableColumnConfigRecord<T> & {
    DefaultHeaderComponent: typeof DesktopHeaderCellComponent<T>
    selected?: 'indeterminate' | boolean
    dataKey?: keyof T
    customKey?: string
  }

export const DesktopHeaderCellComponent = <T extends AnyRecord>(
  props: DesktopHeaderCellRenderProps<T>,
) => (
  <Text color={'gray'}>
    {props.headerText ??
      normalizeDataKeyToReadableString(
        String(props.dataKey ?? '') || props.customKey,
      )}
  </Text>
)
