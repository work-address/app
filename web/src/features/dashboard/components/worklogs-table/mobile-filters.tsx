import { Flex } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'

import {
  TwoSideInput,
  DateRangePicker,
  NoteInput,
  ProjectsSelect,
} from './inputs'

import { $worklogsFilters, applyWorklogFilters } from '@/entities/activities'
import { Button, Drawer, Text } from '@/shared'

export type WorklogsMobileFiltersProps = {
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
}

export const WorklogsMobileFilters = ({
  filtersOpen,
  onFiltersOpenChange,
}: WorklogsMobileFiltersProps) => {
  const { t } = useTranslation()

  const { applyWorklogFiltersEvent } = useUnit({
    applyWorklogFiltersEvent: applyWorklogFilters,
  })

  const activeDateId = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => (filters.fromAt ? 'toAt' : 'fromAt'),
  })

  const handleFiltersApply = () => {
    applyWorklogFiltersEvent()
    onFiltersOpenChange(false)
  }

  return (
    <>
      <Drawer
        open={filtersOpen}
        onOpenChange={onFiltersOpenChange}
        title={
          <Flex justify={'center'}>{t('dashboard.page.filters.title')}</Flex>
        }
        trigger={
          <Button
            type="button"
            themeVariant={'secondary'}
            size={'1'}
            variant={'outline'}
          >
            <S.FilterImage
              src="/img/icons/filter-icon.svg"
              alt={t('dashboard.page.filters.filterIconAlt')}
              width={20}
              height={20}
            />
            {t('dashboard.page.filters.title')}
          </Button>
        }
        footer={
          <Button stretch themeVariant={'primary'} onClick={handleFiltersApply}>
            {t('dashboard.page.filters.apply')}
          </Button>
        }
      >
        <Flex direction={'column'} gap={'2'}>
          <ProjectsSelect />

          <Flex direction={'column'} gap={'2'}>
            <Text
              as={'label'}
              htmlFor={activeDateId}
              size={'2'}
              weight={'medium'}
            >
              {t('dashboard.page.filters.date')}
            </Text>

            <Flex gap={'2'}>
              <DateRangePicker />
            </Flex>
          </Flex>

          <NoteInput />

          <TwoSideInput
            label={t('dashboard.page.filters.timeActive')}
            leftId={'timeActiveMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'timeActiveMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />

          <TwoSideInput
            label={t('dashboard.page.filters.keyboard')}
            leftId={'keyboardKeysMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'keyboardKeysMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />

          <TwoSideInput
            label={t('dashboard.page.filters.mouse')}
            leftId={'mouseKeysMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'mouseKeysMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />

          <TwoSideInput
            label={t('dashboard.page.filters.mouseDistance')}
            leftId={'mouseDistanceMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'mouseDistanceMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />
        </Flex>
      </Drawer>
    </>
  )
}
