/**
 * Who can open the holder's profile page: anyone with the link, or only the
 * holder, with everyone else told it does not exist (`User.visible`).
 *
 * It governs this site's page and nothing else. A profile published on chain
 * stays there, and stays current, until the holder withdraws it there, so the
 * control always says so rather than letting "hidden" read as "withdrawn".
 */
export type ProfileVisibility = 'public' | 'hidden'

/** A record without the flag predates it, and was public. */
export const profileVisibility = (
  visible: boolean | null | undefined,
): ProfileVisibility => (visible === false ? 'hidden' : 'public')

export const PROFILE_VISIBILITY_HINT_KEY: Record<ProfileVisibility, string> = {
  public: 'profile.visibility.public',
  hidden: 'profile.visibility.hidden',
}

/** Every string the control and the holder's hidden-page notice show. */
export const PROFILE_VISIBILITY_COPY_KEYS = [
  'profile.visibility.title',
  'profile.visibility.label',
  ...Object.values(PROFILE_VISIBILITY_HINT_KEY),
  'profile.visibility.chainNote',
  'profile.view.hiddenNotice',
] as const
