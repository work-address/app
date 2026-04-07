import type { AnyRecord, DataTableColumnConfigRecord } from './types'

export type DesktopBodyCellRenderProps<T extends AnyRecord> = {
  data: T
  dataKey?: keyof T
  customKey?: string
  columnConfig: DataTableColumnConfigRecord<T>
  DefaultBodyComponent: typeof DesktopBodyCellComponent<T>
  selected?: boolean
}

export const DesktopBodyCellComponent = <T extends AnyRecord>(
  props: DesktopBodyCellRenderProps<T>,
) => (props.dataKey ? String(props.data[props.dataKey]) : props.customKey)
