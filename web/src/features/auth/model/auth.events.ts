import { createEvent } from 'effector'

import type { LoginMode } from './types'

export const login = createEvent<LoginMode>()
export const logout = createEvent()
export const initAuth = createEvent()
export const setInitialized = createEvent()
