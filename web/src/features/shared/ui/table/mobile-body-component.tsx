import type { AnyRecord, MobileDataTableColumnConfigRecord } from './types'
import type { ReactNode } from 'react'

export type MobileBodyRenderProps<T extends AnyRecord> = {
  data: T
  dataKey?: keyof T
  customKey?: string
  columnConfig: MobileDataTableColumnConfigRecord<T>
  DefaultBodyComponent: typeof MobileBodyComponent<T>
  selected?: boolean
}

export const MobileBodyComponent = <T extends AnyRecord>(
  props: MobileBodyRenderProps<T>,
): ReactNode =>
  (props.dataKey ? String(props.data[props.dataKey]) : props.customKey) || ''
