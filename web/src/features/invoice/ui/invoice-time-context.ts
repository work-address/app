import { createContext } from 'react'

export type InvoiceTimeContextProps = {
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
}

export const InvoiceTimeContext = createContext<InvoiceTimeContextProps>({
  dateFormatter: new Intl.DateTimeFormat(),
  timeFormatter: new Intl.DateTimeFormat(),
})
