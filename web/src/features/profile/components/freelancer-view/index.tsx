import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { Desktop } from './desktop.tsx'
import { Mobile } from './mobile.tsx'

export const FreelancerView = () => {
  const { breakpoints } = useTheme()

  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return isUpMd ? <Desktop /> : <Mobile />
}
