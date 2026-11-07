import { useTranslation } from 'react-i18next'

import { WorkspaceStatus } from './workspace-status'

type Props = {
  /** A request for the page's data is in flight. */
  pending: boolean
  /** The last request failed: nothing is claimed. */
  failed: boolean
  className?: string
}

/**
 * Whether the page shows the server's latest answer. It reads the page's own
 * request state; it never claims that tracking or syncing succeeded.
 */
export const WorkspaceFreshness = ({ pending, failed, className }: Props) => {
  const { t } = useTranslation()

  if (failed) {
    return null
  }

  return pending ? (
    <WorkspaceStatus className={className} tone="neutral">
      {t('common.freshness.updating')}
    </WorkspaceStatus>
  ) : (
    <WorkspaceStatus className={className} tone="positive">
      {t('common.freshness.upToDate')}
    </WorkspaceStatus>
  )
}
