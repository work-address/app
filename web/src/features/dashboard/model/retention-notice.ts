import type { PremiumState } from './premium-state'

/** GET /time/retention-notice, as the dashboard reads it. */
export type RetentionNotice = {
  count: number
  rotatesAt: string | null
  windowDays: number
  noticeDays: number
}

/**
 * Whether the dashboard owes the owner a rotation notice (DEC-05): a free
 * plan with entries due to leave the history within the notice lead time.
 * Premium keeps everything and a self-hosted instance has no free tier, so
 * neither is ever told about a rotation that will not happen to them.
 */
export const retentionNoticeDue = (
  notice: RetentionNotice | null,
  state: PremiumState,
): notice is RetentionNotice & { rotatesAt: string } =>
  state === 'free' &&
  notice !== null &&
  notice.count > 0 &&
  notice.rotatesAt !== null

/** The rotation date in the reader's language, e.g. "24 Sept 2026". */
export const formatRotationDate = (iso: string, language: string): string =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(
    new Date(iso),
  )
