import { createQuery } from '@farfetched/core'
import { AxiosError } from 'axios'
import { sample, combine } from 'effector'
import { createGate } from 'effector-react'

import { $user, $pending as $profilePending } from '@/entities/profile'
import {
  baseApi,
  getFriendlyWalletAddress,
  decodeFriendWalletAddress,
} from '@/shared'

const ProfileGate = createGate<{ userId: string | null }>({
  defaultState: { userId: null },
})

const profileQuery = createQuery({
  handler: async (id: string) => {
    const result = await baseApi.userControllerSearch({
      body: {
        filter: {
          id,
        },
        sort: {},
        page: 0,
      },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return {
      items: (result.data as [baseApi.User[], number])[0],
      total: (result.data as [baseApi.User[], number])[1],
    }
  },
})

const $isAuthenticatedUserProfile = combine(
  $user,
  ProfileGate.state,
  (user, gateState) => user.id === gateState.userId,
)

sample({
  clock: ProfileGate.open,
  source: combine($user, $isAuthenticatedUserProfile),
  filter: ([user, isAuthenticatedUserProfile]) =>
    !isAuthenticatedUserProfile && user.id !== '',
  fn: (_, gateState) => gateState.userId || '',
  target: profileQuery.start,
})

const $profile = combine(
  $user,
  profileQuery.$data,
  ProfileGate.state,
  (user, data, gateState) => {
    if (gateState.userId === user.id) {
      return user
    }

    const profile = data?.items[0]

    return profile
      ? {
          ...profile,
          friendlyWalletAddress: getFriendlyWalletAddress(profile.address),
        }
      : null
  },
)

const $pending = combine(profileQuery.$pending, $profilePending, (...args) =>
  args.some((arg) => arg),
)

export { ProfileGate, $isAuthenticatedUserProfile, $profile }

export { $pending as $profileLoading }
