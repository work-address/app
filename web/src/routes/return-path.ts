type Place = { pathname: string; search: string; hash: string }

/** What a signed-out visitor was after, carried to the sign-in page. */
export const returnState = ({ pathname, search, hash }: Place) => ({
  from: `${pathname}${search}${hash}`,
})

/**
 * The path to go back to after signing in, if there is one. Only a path inside
 * the app counts: to a browser `//host` is another site.
 */
export const returnPathFrom = (state: unknown): string | null => {
  const from = (state as { from?: unknown } | null)?.from

  return typeof from === 'string' && /^\/(?![/\\])/.test(from) ? from : null
}
