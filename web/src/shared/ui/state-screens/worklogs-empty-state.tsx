import { useTranslation } from 'react-i18next'

import { DashboardEmptyState } from './dashboard-empty-state'

type WorklogsEmptyStateProps = {
  onHelp?: () => void
  style?: React.CSSProperties
}

export const WorklogsEmptyState = ({
  onHelp,
  style,
}: WorklogsEmptyStateProps) => {
  const { t } = useTranslation()

  return (
    <DashboardEmptyState
      imageSrc="/img/photo/worklogs-help.svg"
      title={t('dashboard.worklogsEmpty.title')}
      description={t('dashboard.worklogsEmpty.description')}
      actionLabel={t('dashboard.worklogsEmpty.action')}
      onAction={onHelp}
      style={style}
    />
  )
}
