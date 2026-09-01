import { createContext } from 'react'

import type { useTranslation } from 'react-i18next'

export type TimeContextProps = {
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  numberFormatter: Intl.NumberFormat
  t: ReturnType<typeof useTranslation>['t']
}

export const TimeContext = createContext<TimeContextProps>({
  dateFormatter: new Intl.DateTimeFormat(),
  timeFormatter: new Intl.DateTimeFormat(),
  numberFormatter: new Intl.NumberFormat(),
  t: ((key: string) => key) as ReturnType<typeof useTranslation>['t'],
})
