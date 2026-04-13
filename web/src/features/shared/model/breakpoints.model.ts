import { createEvent, createStore } from 'effector'

type Breakpoints = {
  isMobile: boolean
  isDesktop: boolean
}

const updateBreakpoints = createEvent<Partial<Breakpoints>>()

const $breakpoints = createStore<Breakpoints>({
  isDesktop: false,
  isMobile: false,
}).on(updateBreakpoints, (state, payload) => ({ ...state, ...payload }))

$breakpoints.watch(console.log)

export { $breakpoints, updateBreakpoints }
export type { Breakpoints }
