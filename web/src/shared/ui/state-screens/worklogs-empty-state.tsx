import { useTranslation } from 'react-i18next'

import { DashboardEmptyState } from './dashboard-empty-state'

type WorklogsEmptyStateProps = {
  onHelp?: () => void
}

export default function WorklogsEmptyState({ onHelp }: WorklogsEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <DashboardEmptyState
      imageSrc="/img/photo/worklogs-help.svg"
      title={t('dashboard.worklogsEmpty.title')}
      description={t('dashboard.worklogsEmpty.description')}
      actionLabel={t('dashboard.worklogsEmpty.action')}
      onAction={onHelp}
    />
  )
}
