/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type AnyRecord = Record<string, any>

export type KeyProp<T extends AnyRecord> =
  | {
      dataKey: keyof T
    }
  | {
      customKey: string
    }

export type DataTableColumnConfigRecord<T extends AnyRecord> = {
  width?: number
  headerText?: string
  horizontalAlign?: 'start' | 'center' | 'end'
} & KeyProp<T>

export type MobileDataTableColumnConfigRecord<T extends AnyRecord> = {
  isTitle?: boolean
} & KeyProp<T>

export type MobileDataTableConfig<T extends AnyRecord> =
  MobileDataTableColumnConfigRecord<T>[]

export type DataTableConfig<T extends AnyRecord> =
  DataTableColumnConfigRecord<T>[]

export type DataProps<T extends AnyRecord> = {
  data: T[]
  getRowId: (data: T) => string | number
  allowSelection?: boolean
  selectedIds?: Record<string, boolean>
  onSelectedIdsChange?: (data: Record<string, boolean>) => void
}
