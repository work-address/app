import { createQuery } from '@farfetched/core'
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
  runApiData,
  showToastFx,
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

/**
 * What the profile page shows, whoever is looking: the public projection of
 * GET /user/:address/address. Declared rather than inferred - an inferred
 * union of object literals lets `profile.email` compile and render nothing,
 * so a field the public read does not carry has to fail the build instead.
 */
type PublicProfile = baseApi.UserPublic & {
  friendlyWalletAddress: string | null
}

const $profile = combine(
  $user,
  profileQuery.$data,
  $gateAddress,
  (user, loadedProfileData, gateAddress): PublicProfile | null => {
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

/**
 * The holder looking at their own profile while it is hidden: the page they
 * see is one nobody else can open, and it says so.
 */
const $isOwnProfileHidden = combine(
  $user,
  $isAuthenticatedUserProfile,
  (user, isOwnProfile) => isOwnProfile && user?.visible === false,
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
  PROFILE_VISIBILITY_COPY_KEYS,
  PROFILE_VISIBILITY_HINT_KEY,
  profileVisibility,
  type ProfileVisibility,
} from './profile-visibility'
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
  $isOwnProfileHidden,
  $profile,
}

export { $pending as $profileLoading }
