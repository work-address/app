import { createEvent, createStore, sample } from 'effector'

import type { TimeView } from './types'

const VIEW_KEY = 'dashboard_worklogs_view'
const DEFAULT_VIEW: TimeView = 'list'

const isTimeView = (value: string | null): value is TimeView =>
  value === 'list' || value === 'grid'

const readView = (): TimeView => {
  try {
    const stored = localStorage.getItem(VIEW_KEY)

    return isTimeView(stored) ? stored : DEFAULT_VIEW
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. Falling back to the list is a smaller problem than a
    // dashboard that will not render.
    return DEFAULT_VIEW
  }
}

export const timeViewChanged = createEvent<TimeView>()

/**
 * Which presentation the worklogs section is showing.
 *
 * A store rather than component state because the section shell, the filters
 * and the bulk bar all read it, and because it has to survive the section
 * unmounting when the dashboard swaps in its empty state.
 */
export const $timeView = createStore<TimeView>(readView()).on(
  timeViewChanged,
  (_, view) => view,
)

sample({
  clock: $timeView,
  fn: (view) => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Same reasoning as the read: the preference is lost, nothing breaks.
    }

    return view
  },
})
