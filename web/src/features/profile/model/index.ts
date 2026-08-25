import { createQuery } from '@farfetched/core'
import { AxiosError } from 'axios'
import { sample, combine } from 'effector'
import { createGate } from 'effector-react'

import {
  $user,
  $pending as $profilePending,
  saveProfileMutation,
} from '@/entities/profile'
import { routes } from '@/routes'
import {
  baseApi,
  getFriendlyWalletAddress,
  decodeFriendWalletAddress,
  navigateFx,
  showToastFx,
} from '@/shared'

const ProfileGate = createGate<{ friendlyWalletAddress: string | null }>({
  defaultState: { friendlyWalletAddress: null },
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

    return result.data
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

/**
 * What happens after a profile save is a consequence of the mutation
 * finishing, not of a render: the component no longer mirrors mutation status
 * into local state to decide when to toast and when to route away.
 */
sample({
  clock: saveProfileMutation.finished.success,
  fn: () => ({
    type: 'info' as const,
    messageKey: 'profile.form.edit.success',
    closeButton: true,
  }),
  target: showToastFx,
})

sample({
  clock: saveProfileMutation.finished.failure,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'profile.form.edit.error',
    closeButton: true,
  }),
  target: showToastFx,
})

sample({
  clock: saveProfileMutation.finished.finally,
  target: saveProfileMutation.reset,
})

sample({
  clock: saveProfileMutation.finished.success,
  source: $profile,
  fn: (profile) => ({
    to: routes.profile.build({
      walletAddress: profile?.friendlyWalletAddress ?? '',
    }),
    options: { viewTransition: true },
  }),
  target: navigateFx,
})

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
