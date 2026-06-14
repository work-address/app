import { useTranslation } from 'react-i18next'

import { openDocs } from '@/routes'

import { DashboardEmptyState } from './dashboard-empty-state'

import type { CSSProperties } from 'react'

import { routes } from '@/routes'

type WorklogsEmptyStateProps = {
  style?: CSSProperties
}

export const WorklogsEmptyState = ({ style }: WorklogsEmptyStateProps) => {
  const { t } = useTranslation()

  const handleAction = () => {
    window.open(routes.docs.build(), routes.docs.target)
  }

  return (
    <DashboardEmptyState
      imageSrc="/img/photo/worklogs-help.svg"
      title={t('dashboard.worklogsEmpty.title')}
      description={t('dashboard.worklogsEmpty.description')}
      actionLabel={t('dashboard.worklogsEmpty.action')}
      onAction={onHelp ?? openDocs}
      style={style}
    />
  )
}
