import { useStoreMap } from 'effector-react'

import { $breakpoints } from '../model/breakpoints.model'

import type { Breakpoints } from '../model/breakpoints.model'

export const useBreakpoint = (key: keyof Breakpoints) =>
  useStoreMap({
    store: $breakpoints,
    keys: [key],
    fn: (breakpoints) => breakpoints[key],
  })
