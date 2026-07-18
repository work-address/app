import { createContext } from 'react'

import type { useTranslation } from 'react-i18next'

export type WorklogsContextProps = {
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  t: ReturnType<typeof useTranslation>['t']
}

export const WorklogsContext = createContext<WorklogsContextProps>({
  dateFormatter: new Intl.DateTimeFormat(),
  timeFormatter: new Intl.DateTimeFormat(),
  t: ((key: string) => key) as ReturnType<typeof useTranslation>['t'],
})
