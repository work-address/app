import { createQuery } from '@farfetched/core'
import { sample, combine, createEvent } from 'effector'
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
  getLoadFailureKind,
  navigateFx,
  runApiData,
  showToastFx,
  suppressGlobalErrorToast,
  type LoadFailureKind,
} from '@/shared'

const ProfileGate = createGate<{ friendlyWalletAddress: string | null }>({
  defaultState: { friendlyWalletAddress: null },
})

const profileQuery = createQuery({
  handler: async (walletAddress: string) => {
    return runApiData(() =>
      baseApi.userControllerRead({
        path: {
          address: walletAddress as never,
        },
      }),
    )
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

sample({
  clock: $gateAddress,
  target: profileQuery.reset,
})

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
 * Why the profile did not load. An address nobody has signed in with is a
 * 404 - "no profile here yet", not an empty profile with a $0.00 rate - and
 * anything else is worth a retry.
 */
const $profileFailure = combine(
  profileQuery.$failed,
  profileQuery.$error,
  (failed, error): LoadFailureKind | null =>
    failed ? getLoadFailureKind(error) : null,
)

/** Asks for the profile again after a failure. */
const retryProfile = createEvent()

sample({
  clock: retryProfile,
  source: $gateAddress,
  filter: Boolean,
  fn: (address) => decodeFriendWalletAddress(address as string),
  target: profileQuery.start,
})

// The page explains a failed load in place; the generic toast would repeat it.
profileQuery.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)
})

/**
 * What happens after a profile save is a consequence of the mutation
 * finishing, not of a render: the component no longer mirrors mutation status
 * into local state to decide when to toast and when to route away.
 */
sample({
  clock: saveProfileMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
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
export {
  ProfileGate,
  $isAuthenticatedUserProfile,
  $profile,
  $profileFailure,
  retryProfile,
}
export { buildProfileHead, type ProfileHead } from './head'

export { $pending as $profileLoading }
