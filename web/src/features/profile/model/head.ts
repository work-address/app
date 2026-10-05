/** What the profile page puts in the tab and the link preview. */
export type ProfileHead = {
  title: string
  description: string
  /** Someone else's profile is public; your own view of it is not indexed
   * twice, and a missing one is not indexed at all. */
  noindex: boolean
}

type Translate = (key: string, params?: Record<string, unknown>) => string

type ProfileHeadInput = {
  name?: string | null
  /** The short form of the wallet address, for a profile without a name. */
  address?: string | null
  isOwn: boolean
  failure?: 'not-found' | 'failed' | null
}

/**
 * The tab reads as the person, not as "My account": a visitor opened Gudrun's
 * profile, so the tab says Gudrun. Only your own profile keeps the personal
 * title, so it can be told apart from the profiles you are looking at.
 */
export function buildProfileHead(
  { name, address, isOwn, failure = null }: ProfileHeadInput,
  t: Translate,
): ProfileHead {
  if (failure === 'not-found') {
    return {
      title: t('profile.notFound.documentTitle'),
      description: t('profile.head.descriptionGeneric'),
      noindex: true,
    }
  }

  const who = name?.trim() || address || null

  if (isOwn) {
    return {
      title: t('profile.title'),
      description: t('profile.head.descriptionOwn'),
      noindex: true,
    }
  }

  return {
    title: who ?? t('profile.head.titleGeneric'),
    description: who
      ? t('profile.head.description', { name: who })
      : t('profile.head.descriptionGeneric'),
    noindex: false,
  }
}
