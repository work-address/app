import { createContext } from 'react'

import type { useTranslation } from 'react-i18next'

export type TimeContextProps = {
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  dayFormatter: Intl.DateTimeFormat
  numberFormatter: Intl.NumberFormat
  t: ReturnType<typeof useTranslation>['t']
}

/**
 * Formatters shared by every worklogs presentation.
 *
 * They are built once by the section shell rather than per cell or per tile:
 * constructing an Intl formatter is not free, and the grid renders hundreds of
 * tiles from one page of the feed.
 */
export const TimeContext = createContext<TimeContextProps>({
  dateFormatter: new Intl.DateTimeFormat(),
  timeFormatter: new Intl.DateTimeFormat(),
  dayFormatter: new Intl.DateTimeFormat(),
  numberFormatter: new Intl.NumberFormat(),
  t: ((key: string) => key) as ReturnType<typeof useTranslation>['t'],
})
