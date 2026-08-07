import { Flex } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { TimeDateRangePicker } from './time-date-range-picker'
import { TimeNoteInput } from './time-note-input'
import { TimeProjectsSelect } from './time-projects-select'
import { TimeTwoSideInput } from './time-two-side-input'

import { $worklogsFilters, applyWorklogFilters } from '@/entities/time'
import { DashboardStyles as S } from '@/features/dashboard'
import { Button, Drawer, FilterIcon, Text } from '@/shared'

export type TimeMobileFiltersProps = {
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
}

export const TimeMobileFilters = ({
  filtersOpen,
  onFiltersOpenChange,
}: TimeMobileFiltersProps) => {
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
            color="neutral"
            variant="outline"
            size="s"
            iconLeft={
              <S.FilterImage
                src={FilterIcon}
                alt={t('dashboard.page.filters.filterIconAlt')}
                width={20}
                height={20}
              />
            }
          >
            {t('dashboard.page.filters.title')}
          </Button>
        }
        footer={
          <Button stretch onClick={handleFiltersApply}>
            {t('dashboard.page.filters.apply')}
          </Button>
        }
      >
        <Flex direction={'column'} gap={'2'}>
          <TimeProjectsSelect />
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
              <TimeDateRangePicker />
            </Flex>
          </Flex>
          <TimeNoteInput />
          <TimeTwoSideInput
            label={t('dashboard.page.filters.timeActive')}
            leftId={'timeActiveMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'timeActiveMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />
          <TimeTwoSideInput
            label={t('dashboard.page.filters.keyboard')}
            leftId={'keyboardKeysMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'keyboardKeysMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />
          <TimeTwoSideInput
            label={t('dashboard.page.filters.mouse')}
            leftId={'mouseKeysMin'}
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'mouseKeysMax'}
            rightPlaceholder={t('dashboard.page.filters.max')}
            inputMode="numeric"
          />
          <TimeTwoSideInput
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
