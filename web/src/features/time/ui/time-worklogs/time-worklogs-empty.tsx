import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $hasActiveTimeFilters, resetTimeFilters } from '@/entities/time'
import { routes } from '@/routes'
import { Button, StateNotice } from '@/shared'

/**
 * The panel's empty content. No matches for the filters and no time at all
 * are different situations, so each gets its own words and way on.
 */
export const TimeWorklogsEmpty = () => {
  const { t } = useTranslation()

  const { hasActiveFilters, reset } = useUnit({
    hasActiveFilters: $hasActiveTimeFilters,
    reset: resetTimeFilters,
  })

  return (
    <Root>
      {hasActiveFilters ? (
        <StateNotice
          title={t('dashboard.worklogsEmpty.title.afterFilters')}
          description={t('dashboard.worklogsEmpty.description.afterFilters')}
          actions={
            <Button variant="outline" onClick={() => reset()}>
              {t('dashboard.worklogsEmpty.action.filtersReset')}
            </Button>
          }
        />
      ) : (
        <StateNotice
          title={t('dashboard.worklogsEmpty.title')}
          description={t('dashboard.worklogsEmpty.description')}
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
