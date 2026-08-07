import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { DashboardEmptyState } from './dashboard-empty-state'

import type { CSSProperties } from 'react'

import { $hasActiveTimeFilters, resetTimeFilters } from '@/entities/time'
import { routes } from '@/routes'
import { TimeHelpImage } from '@/shared'

type TimeEmptyStateProps = {
  style?: CSSProperties
}

export const TimeEmptyState = ({ style }: TimeEmptyStateProps) => {
  const { t } = useTranslation()

  const { hasActiveFilters, resetTimeFiltersEvent } = useUnit({
    hasActiveFilters: $hasActiveTimeFilters,
    resetTimeFiltersEvent: resetTimeFilters,
  })

  const handleHelpAction = () => {
    window.open(routes.docs.build(), routes.docs.target)
  }

  if (hasActiveFilters) {
    return (
      <DashboardEmptyState
        imageSrc={TimeHelpImage}
        title={t('dashboard.worklogsEmpty.title.afterFilters')}
        description={t('dashboard.worklogsEmpty.description.afterFilters')}
        actionLabel={t('dashboard.worklogsEmpty.action.filtersReset')}
        onAction={resetTimeFiltersEvent}
        style={style}
      />
    )
  }

  return (
    <DashboardEmptyState
      imageSrc={TimeHelpImage}
      title={t('dashboard.worklogsEmpty.title')}
      description={t('dashboard.worklogsEmpty.description')}
      actionLabel={t('dashboard.worklogsEmpty.action')}
      onAction={handleHelpAction}
      style={style}
    />
  )
}
