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
  handler: async (walletAddress: string) => {
    const result = await baseApi.userControllerRead({
      path: {
        address: walletAddress as never,
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
  (user, gateState) =>
    Boolean(user) &&
    user?.friendlyWalletAddress === gateState.friendlyWalletAddress,
)

const $gateAddress = ProfileGate.state.map(
  (gateState) => gateState.friendlyWalletAddress,
)

// Сбрасываем данные предыдущего профиля до старта новой загрузки,
// чтобы при переходе между профилями не мелькали чужие данные.
sample({
  clock: $gateAddress,
  target: profileQuery.reset,
})

// Публичный профиль грузим всегда — и гостю, и владельцу (одинаковые поля с API)
sample({
  clock: $gateAddress,
  filter: Boolean,
  fn: (address) => decodeFriendWalletAddress(address as string),
  target: profileQuery.start,
})

sample({
  clock: ProfileGate.close,
  target: profileQuery.reset,
})

const $profile = combine(
  $user,
  profileQuery.$data,
  $gateAddress,
  (user, loadedProfileData, gateAddress) => {
    if (!gateAddress) {
      return null
    }

    if (loadedProfileData) {
      return {
        ...loadedProfileData,
        friendlyWalletAddress:
          getFriendlyWalletAddress(loadedProfileData.address) ?? gateAddress,
      }
    }

    if (user?.friendlyWalletAddress === gateAddress) {
      return user
    }

    return null
  },
)

const $pending = combine(profileQuery.$pending, $profilePending, (...args) =>
  args.some((arg) => arg),
)

export {
  containsHost,
  normalizeLink,
  SKILLS_SUGGESTIONS,
  SOCIAL_DOMAIN_BY_FIELD,
  SOCIAL_LINKS,
  type SocialLinkField,
} from './profile-field'
export { ProfileGate, $isAuthenticatedUserProfile, $profile }

export { $pending as $profileLoading }
