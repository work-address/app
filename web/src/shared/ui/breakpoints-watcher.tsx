import { useUnit } from 'effector-react'
import { memo, useEffect } from 'react'
import { useTheme } from 'styled-components'

import { updateBreakpoints } from '../model/breakpoints.model'

const createBreakpointEffect = (
  query: string,
  stateSetter: (e: MediaQueryListEvent | MediaQueryList) => void,
) => {
  const cleanQuery = query.replace('@media ', '').trim()

  const mql = window.matchMedia(cleanQuery)
  mql.addEventListener('change', stateSetter)
  stateSetter(mql)

  return { unsub: () => mql.removeEventListener('change', stateSetter) }
}

export const BreakpointsWatcher = memo(() => {
  const { breakpoints } = useTheme()
  const updateBreakpointsEvent = useUnit(updateBreakpoints)

  useEffect(() => {
    const { unsub } = createBreakpointEffect(breakpoints.down('md'), (e) =>
      updateBreakpointsEvent({ isMobile: e.matches }),
    )

    return unsub
  }, [breakpoints, updateBreakpointsEvent])

  useEffect(() => {
    const { unsub } = createBreakpointEffect(breakpoints.up('md'), (e) =>
      updateBreakpointsEvent({ isDesktop: e.matches }),
    )

    return unsub
  }, [breakpoints, updateBreakpointsEvent])

  return null
})
