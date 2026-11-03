/** What the profile page puts in the tab and the link preview. */
export type ProfileHead = {
  title: string
  description: string
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
    }
  }

  if (failure === 'failed') {
    return {
      title: t('profile.loadFailure.title'),
      description: t('profile.head.descriptionGeneric'),
    }
  }

  const who = name?.trim() || address || null

  if (isOwn) {
    return {
      title: t('profile.title'),
      description: t('profile.head.descriptionOwn'),
    }
  }

  return {
    title: who ?? t('profile.head.titleGeneric'),
    description: who
      ? t('profile.head.description', { name: who })
      : t('profile.head.descriptionGeneric'),
  }
}
