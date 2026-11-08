/** How long a tab gets to close itself before we navigate it instead. */
export const CLOSE_GRACE_MS = 300

type ExitWindow = {
  opener: { closed: boolean } | null
  close: () => void
  location: { replace: (url: string) => void }
  setTimeout: (handler: () => void, timeout: number) => unknown
}

/**
 * The page to return to, when `/connect` was opened by the website. Only an
 * exact match on a configured origin counts: this value ends up in a redirect,
 * so anything else is treated as no return address at all, which leaves the
 * page behaving as it does for the desktop time tracker.
 */
export const parseWebsiteReturn = (
  raw: string | null,
  allowedOrigins: readonly string[],
): string | null => {
  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)

    if (url.username || url.password) {
      return null
    }

    return allowedOrigins.includes(url.origin) ? url.href : null
  } catch {
    return null
  }
}

/** The website tab that opened this one is still there to go back to. */
const hasLiveOpener = ({ opener }: ExitWindow): boolean =>
  Boolean(opener && !opener.closed)

/**
 * Hands the user back once they are signed in. The tab closes when its opener
 * is still there. Otherwise it goes to the return page, where the website
 * resumes the pairing it saved. A browser may refuse to close the tab, which
 * leaves the "You're signed in" screen and its way back on show.
 */
export const finishWebsiteSignIn = (
  win: ExitWindow,
  returnTo: string,
): void => {
  if (hasLiveOpener(win)) {
    win.close()
    return
  }

  win.location.replace(returnTo)
}

/**
 * Leaves because the user asked to. Unlike finishing, there is no screen left
 * to fall back on, so a tab that refuses to close is navigated instead.
 */
export const leaveForWebsite = (win: ExitWindow, returnTo: string): void => {
  if (!hasLiveOpener(win)) {
    win.location.replace(returnTo)
    return
  }

  win.close()
  win.setTimeout(() => win.location.replace(returnTo), CLOSE_GRACE_MS)
}
