import { AxiosError } from 'axios'
import { createStore } from 'effector'

import { connectTimeTrackerFx, fetchTimeTrackerNonceFx } from './effects'
import {
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
  timeTrackerConnected,
  timeTrackerConnectFailed,
} from './events'

import type { TimeTrackerConnectPhase } from './types'

export const $nonce = createStore<string | null>(null)
  .on(initTimeTrackerConnect, (_, nonce) => nonce)
  .reset(resetTimeTrackerConnect)

export const $phase = createStore<TimeTrackerConnectPhase>('idle')
  .on(initTimeTrackerConnect, () => 'loading')
  .on(fetchTimeTrackerNonceFx, () => 'loading')
  .on(connectTimeTrackerFx, () => 'connecting')
  .on(timeTrackerConnected, () => 'connected')
  .on(timeTrackerConnectFailed, () => 'error')
  .reset(resetTimeTrackerConnect)

export const $errorMessage = createStore<string | null>(null)
  .on(timeTrackerConnectFailed, (_, { error }) => {
    if (error instanceof AxiosError) {
      const data = error.response?.data

      if (data && typeof data === 'object' && 'message' in data) {
        const message = (data as { message?: unknown }).message

        if (typeof message === 'string' && message.length > 0) {
          return message
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message
    }

    return null
  })
  .reset([
    resetTimeTrackerConnect,
    fetchTimeTrackerNonceFx,
    connectTimeTrackerFx,
  ])

export const $errorName = createStore<string | null>(null)
  .on(timeTrackerConnectFailed, (_, { error }) => {
    if (error instanceof AxiosError) {
      const data = error.response?.data

      if (data && typeof data === 'object' && 'name' in data) {
        const name = (data as { name?: unknown }).name

        if (typeof name === 'string' && name.length > 0) {
          return name
        }
      }
    }

    return null
  })
  .reset([
    resetTimeTrackerConnect,
    fetchTimeTrackerNonceFx,
    connectTimeTrackerFx,
  ])
