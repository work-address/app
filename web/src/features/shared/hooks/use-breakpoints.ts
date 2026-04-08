import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

export const useBreakpoints = () => {
  const { breakpoints } = useTheme()

  const isMobile = useMediaQuery(breakpoints.down('md'))
  const isDesktop = useMediaQuery(breakpoints.up('md'))

  return {
    isMobile,
    isDesktop,
  }
}
