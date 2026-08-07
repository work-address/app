import { createContext } from 'react'

export type InvoiceWorklogsContextProps = {
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
}

export const InvoiceWorklogsContext =
  createContext<InvoiceWorklogsContextProps>({
    dateFormatter: new Intl.DateTimeFormat(),
    timeFormatter: new Intl.DateTimeFormat(),
  })
