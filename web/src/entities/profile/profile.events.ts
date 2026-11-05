import { createEvent } from 'effector'

export const logout = createEvent()
/** The person chose to leave, as opposed to their session ending. */
export const signOut = createEvent()
export const initAuth = createEvent()
export const setInitialized = createEvent()
