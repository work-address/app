/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type AnyRecord = Record<string, any>

export type KeyProp<T extends AnyRecord> =
  | {
      dataKey: keyof T
    }
  | {
      customKey: string
    }

type CommonProps<T> = {
  headerText?: string
  getValue?: (data: T) => React.ReactNode
}

export type DataTableColumnConfigRecord<T extends AnyRecord> = {
  width?: number
  horizontalAlign?: 'start' | 'center' | 'end'
  sticky?: 'right' | 'left'
} & CommonProps<T> &
  KeyProp<T>

export type MobileDataTableColumnConfigRecord<T extends AnyRecord> = {
  isTitle?: boolean
  description?: string
} & CommonProps<T> &
  KeyProp<T>

export type MobileDataTableConfig<T extends AnyRecord> =
  MobileDataTableColumnConfigRecord<T>[]

export type MobileAddonBottomProps<T extends AnyRecord> = { data: T }

export type DataTableConfig<T extends AnyRecord> =
  DataTableColumnConfigRecord<T>[]

export type NonNullableSelectionProps = {
  allowSelection: true
  selectedIds: Record<string, boolean>
  onSelectedIdsChange: (data: Record<string, boolean>) => void
}

export type SelectionProps =
  | NonNullableSelectionProps
  | {
      allowSelection?: false
    }

export type DataProps<T extends AnyRecord> = {
  data: T[]
  getRowId: (data: T) => string | number
  loading?: boolean
  mockDataLength?: number
} & SelectionProps
