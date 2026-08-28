/** Locales the marketing site publishes billing under. */
const BILLING_LOCALES = new Set(['en', 'es', 'ja', 'ru', 'zh'])

/**
 * Where "Upgrade to Premium" goes.
 *
 * Billing lives on the marketing site, not in the dashboard, so this is an
 * absolute cross-origin URL rather than a route. The path is locale-prefixed;
 * anything the marketing site does not publish falls back to `en` so the link
 * cannot 404 on a language we added to the dashboard first.
 */
export const billingUrl = (language: string | undefined): string => {
  const locale = (language ?? 'en').split('-')[0].toLowerCase()
  const supported = BILLING_LOCALES.has(locale) ? locale : 'en'

  return `https://address.work/${supported}/billing/`
}
