import i18n from 'i18next'

import { getErrorMessage } from '@/shared/lib/get-error-message'
import { showToast } from '@/shared/lib/sonner'

/**
 * Who tells the person a request failed (docs/failure-reporting.md). A request
 * that says nothing gets the interceptor's generic toast.
 *
 * - `'in-place'`: the page shows the failure itself, so nothing is toasted.
 * - `fallback`: a toast with the server's message, or this translation key
 *   when it sent none.
 * - `fixed`: a toast with this translation key, whatever the server said.
 */
export type FailureReport =
  | 'in-place'
  | { fallback: string }
  | { fixed: string; closeButton?: boolean }

// Failures already reported here, which the interceptor must not toast again.
const reported = new WeakSet<object>()

/** Whether a failure was reported as its request declared. */
export const isReported = (error: unknown): boolean =>
  error !== null && typeof error === 'object' && reported.has(error)

/** Reports a failed request the way it declared, once. */
export const reportFailure = (error: unknown, report: FailureReport): void => {
  if (error !== null && typeof error === 'object') {
    reported.add(error)
  }

  if (report === 'in-place') {
    return
  }

  // A wallet the person closed themselves has no message, and gets no toast.
  const message =
    'fixed' in report
      ? i18n.t(report.fixed)
      : getErrorMessage(error, i18n.t(report.fallback))

  if (message) {
    showToast('error', {
      message,
      position: 'top-center',
      closeButton: 'fixed' in report ? report.closeButton : undefined,
    })
  }
}
