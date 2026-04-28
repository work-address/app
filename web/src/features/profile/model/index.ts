import { createQuery } from '@farfetched/core'
import { AxiosError } from 'axios'
import { sample, combine } from 'effector'
import { createGate } from 'effector-react'

import { $user } from '@/entities/profile'
import {
  baseApi,
  getFriendlyWalletAddress,
  decodeFriendWalletAddress,
} from '@/shared'

const ProfileGate = createGate<{ friendlyWalletAddress: string | null }>({
  defaultState: { friendlyWalletAddress: null },
})

const profileQuery = createQuery({
  handler: async (walletAddress: string) => {
    const result = await baseApi.userControllerRead({
      path: {
        address: walletAddress,
      },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result.data
  },
})

const $isAuthenticatedUserProfile = combine(
  $user,
  ProfileGate.state,
  (user, gateState) =>
    user.friendlyWalletAddress === gateState.friendlyWalletAddress,
)

sample({
  clock: ProfileGate.open,
  source: combine($user, $isAuthenticatedUserProfile),
  filter: ([user, isAuthenticatedUserProfile]) =>
    !isAuthenticatedUserProfile && user.id !== '',
  fn: (_, gateState) =>
    gateState.friendlyWalletAddress
      ? decodeFriendWalletAddress(gateState.friendlyWalletAddress)
      : '',
  target: profileQuery.start,
})

const $profile = combine(
  $user,
  profileQuery.$data,
  ProfileGate.state,
  (user, data, gateState) => {
    if (gateState.friendlyWalletAddress === user.friendlyWalletAddress) {
      return user
    }

    return data
      ? {
          ...data,
          friendlyWalletAddress: getFriendlyWalletAddress(data.address),
        }
      : null
  },
)

export { ProfileGate, $isAuthenticatedUserProfile, $profile }
