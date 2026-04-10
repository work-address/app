import { Flex, Grid } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'

import type { WorklogFormFilters } from './types'
import type { ChangeEvent } from 'react'

import {
  Button,
  DatePickerInput,
  Drawer,
  Input,
  MotionSelect,
  Text,
} from '@/features/shared'

type ProjectOption = { value: string; label: string }

type WorklogsMobileFiltersProps = {
  projectOptions: ProjectOption[]
  worklogProjects: string[]
  onToggleProject: (value: string) => void
  selectedProjectsLabel: string
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
  projectsDrawerOpen: boolean
  onProjectsDrawerOpenChange: (open: boolean) => void
  fromDate: Date | null
  onFromDateChange: (value: Date | null) => void
  toDate: Date | null
  onToDateChange: (value: Date | null) => void
  worklogQuery: string
  onWorklogQueryChange: (value: string) => void
  onWorklogProjectsChange: (value: string[]) => void
  formFilters: WorklogFormFilters
  onFormFiltersChange: (patch: Partial<WorklogFormFilters>) => void
}

export const WorklogsMobileFilters = ({
  projectOptions,
  worklogProjects,
  onToggleProject,
  filtersOpen,
  onFiltersOpenChange,
  projectsDrawerOpen,
  onProjectsDrawerOpenChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  formFilters,
  onFormFiltersChange,
  onWorklogProjectsChange,
}: WorklogsMobileFiltersProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Drawer
        open={filtersOpen}
        onOpenChange={onFiltersOpenChange}
        title={
          <Flex justify={'center'}>
            {t('dashboard.page.filters.title', {
              defaultValue: 'Filters',
            })}
          </Flex>
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
              alt="Filter"
              width={20}
              height={20}
            />
            {t('dashboard.page.filters.title', {
              defaultValue: 'Filters',
            })}
          </Button>
        }
        description={
          <Button stretch themeVariant={'primary'}>
            {t('dashboard.page.filters.apply', {
              defaultValue: 'Apply',
            })}
          </Button>
        }
      >
        <Flex direction={'column'} gap={'2'}>
          <MotionSelect
            label={t('dashboard.page.filters.projects')}
            options={projectOptions}
            value={worklogProjects}
            onChange={(v) =>
              Array.isArray(v) ? onWorklogProjectsChange(v) : undefined
            }
            allSelectedText={t('dashboard.page.filters.allWorklogs')}
            placeholder={'Select projects'}
            multi
          />

          <Flex direction={'column'} gap={'2'}>
            <Text htmlFor={'dateFrom'} size={'2'} weight={'medium'}>
              {t('dashboard.page.filters.date')}
            </Text>

            <Flex gap={'2'}>
              <DatePickerInput
                id={'dateFrom'}
                value={fromDate}
                onChange={onFromDateChange}
                placeholder={t('dashboard.page.filters.from')}
              />

              <DatePickerInput
                id={'dateTo'}
                value={toDate}
                onChange={onToDateChange}
                placeholder={t('dashboard.page.filters.to')}
              />
            </Flex>
          </Flex>

          <Input
            label={'Note'}
            placeholder={t('dashboard.page.filters.searchNote')}
          />

          <TwoSideInput
            label={t('dashboard.page.filters.timeActive')}
            leftId={'timeActiveMin'}
            leftValue={formFilters.timeActiveMin}
            onLeftChange={(e) =>
              onFormFiltersChange({ timeActiveMin: e.currentTarget.value })
            }
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'timeActiveMax'}
            rightValue={formFilters.timeActiveMax}
            onRightChange={(e) =>
              onFormFiltersChange({ timeActiveMax: e.currentTarget.value })
            }
            rightPlaceholder={t('dashboard.page.filters.max')}
          />

          <TwoSideInput
            label={t('dashboard.page.filters.keyboard')}
            leftValue={formFilters.keyboardMin}
            leftId={'keyboardMin'}
            onLeftChange={(e) =>
              onFormFiltersChange({ keyboardMin: e.target.value })
            }
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'keyboardMax'}
            rightValue={formFilters.keyboardMax}
            onRightChange={(e) =>
              onFormFiltersChange({ keyboardMax: e.target.value })
            }
            rightPlaceholder={t('dashboard.page.filters.max')}
          />

          <TwoSideInput
            label={t('dashboard.page.filters.mouse')}
            leftValue={formFilters.mouseMin}
            leftId={'mouseMin'}
            onLeftChange={(e) =>
              onFormFiltersChange({ mouseMin: e.target.value })
            }
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'mouseMax'}
            rightValue={formFilters.mouseMax}
            onRightChange={(e) =>
              onFormFiltersChange({ mouseMax: e.target.value })
            }
            rightPlaceholder={t('dashboard.page.filters.max')}
          />

          <TwoSideInput
            label={t('dashboard.page.filters.mouseDistance')}
            leftValue={formFilters.mouseDistanceMin}
            leftId={'mouseDistanceMin'}
            onLeftChange={(e) =>
              onFormFiltersChange({
                mouseDistanceMin: e.target.value,
              })
            }
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightId={'mouseDistanceMax'}
            rightValue={formFilters.mouseDistanceMax}
            onRightChange={(e) =>
              onFormFiltersChange({
                mouseDistanceMax: e.target.value,
              })
            }
            rightPlaceholder={t('dashboard.page.filters.max')}
          />
        </Flex>
      </Drawer>

      <Drawer
        open={projectsDrawerOpen}
        onOpenChange={onProjectsDrawerOpenChange}
        title={t('dashboard.page.filters.projectsTitle')}
        description={
          <Button stretch themeVariant={'primary'}>
            {t('dashboard.page.filters.apply', {
              defaultValue: 'Apply',
            })}
          </Button>
        }
      >
        <S.ProjectsList>
          {projectOptions.map((opt) => {
            const selected = worklogProjects.includes(opt.value)

            return (
              <S.ProjectRowButton
                key={opt.value}
                type="button"
                $selected={selected}
                onClick={() => onToggleProject(opt.value)}
              >
                <S.ProjectRowLabel>{opt.label}</S.ProjectRowLabel>
                {selected ? <S.CheckIcon aria-hidden /> : null}
              </S.ProjectRowButton>
            )
          })}
        </S.ProjectsList>
      </Drawer>
    </>
  )
}

type TwoSideInputProps = {
  label: string
  leftValue: string
  leftId: string
  onLeftChange: (e: ChangeEvent<HTMLInputElement>) => void
  leftPlaceholder: string
  rightId: string
  rightValue: string
  onRightChange: (e: ChangeEvent<HTMLInputElement>) => void
  rightPlaceholder: string
}

const TwoSideInput = ({
  label,
  leftId,
  onLeftChange,
  onRightChange,
  rightId,
  rightValue,
  leftValue,
  leftPlaceholder,
  rightPlaceholder,
}: TwoSideInputProps) => {
  return (
    <Grid columns={'auto'} gap={'2'}>
      <Text size={'2'} weight={'medium'}>
        {label}
      </Text>

      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Input
          id={leftId}
          value={leftValue}
          onChange={onLeftChange}
          placeholder={leftPlaceholder}
        />

        <Input
          id={rightId}
          value={rightValue}
          onChange={onRightChange}
          placeholder={rightPlaceholder}
        />
      </Grid>
    </Grid>
  )
}
