/**
 * What the account's plan means on this instance, for the header badge and
 * the dashboard banner.
 *
 * `unbilled` is a self-hosted instance: it is unrestricted and has no plan to
 * sell, so it shows no premium state at all rather than a 'No premium' it can
 * never change and an Upgrade link to a hosted service that does not apply.
 * The API says so with `billing: false`; an older API that does not send the
 * field is treated as billed, which is what it always was.
 */
export type PremiumState = 'premium' | 'free' | 'unbilled'

export const premiumState = (
  user: { premium?: boolean | null; billing?: boolean | null } | null,
): PremiumState => {
  if (user?.billing === false) {
    return 'unbilled'
  }

  return user?.premium ? 'premium' : 'free'
}
