import { useEffect } from 'react'

import { pageBusyClaimed, pageBusyReleased } from '../model/page-busy.model'

/**
 * Runs the page indicator while `busy` holds. The claim goes with the
 * component, so leaving a page mid-reload cannot leave the bar running.
 */
export const usePageBusy = (busy: boolean | undefined) => {
  useEffect(() => {
    if (!busy) {
      return
    }

    pageBusyClaimed()

    return () => {
      pageBusyReleased()
    }
  }, [busy])
}
