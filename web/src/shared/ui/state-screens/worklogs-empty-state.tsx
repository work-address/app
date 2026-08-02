import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { openDocs } from '@/routes'

import { DashboardEmptyState } from './dashboard-empty-state'

import type { CSSProperties } from 'react'

import { $hasActiveWorklogFilters, resetWorklogFilters } from '@/entities/time'
import { routes } from '@/routes'
import { WorklogsHelpImage } from '@/shared'

type WorklogsEmptyStateProps = {
  style?: CSSProperties
}

export const WorklogsEmptyState = ({ style }: WorklogsEmptyStateProps) => {
  const { t } = useTranslation()

  const { hasActiveFilters, resetWorklogFiltersEvent } = useUnit({
    hasActiveFilters: $hasActiveWorklogFilters,
    resetWorklogFiltersEvent: resetWorklogFilters,
  })

  const handleHelpAction = () => {
    window.open(routes.docs.build(), routes.docs.target)
  }

  if (hasActiveFilters) {
    return (
      <DashboardEmptyState
        imageSrc={WorklogsHelpImage}
        title={t('dashboard.worklogsEmpty.title.afterFilters')}
        description={t('dashboard.worklogsEmpty.description.afterFilters')}
        actionLabel={t('dashboard.worklogsEmpty.action.filtersReset')}
        onAction={resetWorklogFiltersEvent}
        buttonThemeVariant="primary"
        style={style}
      />
    )
  }

  return (
    <DashboardEmptyState
      imageSrc={WorklogsHelpImage}
      title={t('dashboard.worklogsEmpty.title')}
      description={t('dashboard.worklogsEmpty.description')}
      actionLabel={t('dashboard.worklogsEmpty.action')}
      onAction={handleHelpAction}
      style={style}
    />
  )
}
