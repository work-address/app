import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $projects } from '@/entities/projects'
import { $hasActiveTimeFilters, resetTimeFilters } from '@/entities/time'
import { routes } from '@/routes'
import { Button, StateNotice } from '@/shared'

/**
 * The panel's empty content. No matches for the filters and no time at all
 * are different situations, so each gets its own words and way on.
 */
export const TimeWorklogsEmpty = () => {
  const { t } = useTranslation()

  const { hasActiveFilters, reset, projects } = useUnit({
    hasActiveFilters: $hasActiveTimeFilters,
    reset: resetTimeFilters,
    projects: $projects,
  })
  // Entries are listed only on projects one owns or works on; someone who
  // only views projects sees their totals above and never a row here.
  const viewsOnly =
    projects.length > 0 &&
    projects.every((project) => project.role === 'viewer')

  return (
    <Root>
      {viewsOnly ? (
        <StateNotice
          title={t('time.viewOnly.title')}
          description={t('time.viewOnly.description')}
        />
      ) : hasActiveFilters ? (
        <StateNotice
          title={t('time.noMatch.title')}
          description={t('time.noMatch.description')}
          actions={
            <Button variant="outline" onClick={() => reset()}>
              {t('dashboard.worklogsEmpty.action.filtersReset')}
            </Button>
          }
        />
      ) : (
        <StateNotice
          title={t('time.empty.title')}
          description={t('time.empty.description')}
          actions={
            <Button
              variant="outline"
              onClick={() =>
                window.open(routes.docs.build(), routes.docs.target)
              }
            >
              {t('dashboard.worklogsEmpty.action')}
            </Button>
          }
        />
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  min-height: var(--ui-placeholder-height);
  align-content: center;
`
