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
  getLoadFailureKind,
  navigateFx,
  runApiData,
  showToastFx,
  suppressGlobalErrorToast,
  type LoadFailureKind,
} from '@/shared'

const ProfileGate = createGate<{ id: string | null }>({
  defaultState: { id: null },
})

const profileQuery = createQuery({
  handler: async (id: string) => {
    return runApiData(() =>
      baseApi.userControllerRead({
        path: {
          id: id as never,
        },
      }),
    )
  },
})

const $isAuthenticatedUserProfile = combine(
  $user,
  ProfileGate.state,
  (user, gateState) => Boolean(user) && user?.id === gateState.id,
)

const $gateId = ProfileGate.state.map((gateState) => gateState.id)

sample({
  clock: $gateId,
  target: profileQuery.reset,
})

sample({
  clock: $gateId,
  filter: Boolean,
  fn: (id) => id as string,
  target: profileQuery.start,
})

sample({
  clock: ProfileGate.close,
  target: profileQuery.reset,
})

const $profile = combine(
  $user,
  profileQuery.$data,
  $gateId,
  (user, loadedProfileData, gateId) => {
    if (!gateId) {
      return null
    }

    // Your own account is the fuller answer: other people's reads leave out
    // what only the account's owner gets, such as premium.
    if (user?.id === gateId) {
      return user
    }

    return loadedProfileData ?? null
  },
)

const $pending = combine(profileQuery.$pending, $profilePending, (...args) =>
  args.some((arg) => arg),
)

/**
 * Why the profile did not load. An id no account has is a
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
  source: $gateId,
  filter: Boolean,
  fn: (id) => id as string,
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
      id: profile?.id ?? '',
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
