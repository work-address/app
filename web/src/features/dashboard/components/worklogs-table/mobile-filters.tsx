import { useTranslation } from 'react-i18next'
import { Drawer } from 'vaul'

import * as S from '../dashboard-styles.ts'

import type { WorklogFormFilters } from './types'

import { DatePickerInput } from '@/features/shared'

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
  fromDate: Date | undefined
  onFromDateChange: (value: Date | undefined) => void
  toDate: Date | undefined
  onToDateChange: (value: Date | undefined) => void
  worklogQuery: string
  onWorklogQueryChange: (value: string) => void
  formFilters: WorklogFormFilters
  onFormFiltersChange: (patch: Partial<WorklogFormFilters>) => void
}

export const WorklogsMobileFilters = ({
  projectOptions,
  worklogProjects,
  onToggleProject,
  selectedProjectsLabel,
  filtersOpen,
  onFiltersOpenChange,
  projectsDrawerOpen,
  onProjectsDrawerOpenChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  worklogQuery,
  onWorklogQueryChange,
  formFilters,
  onFormFiltersChange,
}: WorklogsMobileFiltersProps) => {
  const { t } = useTranslation()

  return (
    <S.MobileOnly>
      <Drawer.Root open={filtersOpen} onOpenChange={onFiltersOpenChange}>
        <Drawer.Trigger asChild>
          <S.FiltersButton type="button">
            <S.FilterImage
              src="/img/icons/filter-icon.svg"
              alt="Filter"
              width={20}
              height={20}
            />
            {t('dashboard.page.filters.title', {
              defaultValue: 'Filters',
            })}
          </S.FiltersButton>
        </Drawer.Trigger>

        <Drawer.Portal>
          <S.DrawerOverlay />

          <S.DrawerContent>
            <S.Sheet>
              <S.SheetHandle />

              <S.SheetTitle>
                {t('dashboard.page.filters.title', {
                  defaultValue: 'Filters',
                })}
              </S.SheetTitle>

              <S.MobileFilters>
                <S.Field>
                  <S.Label>{t('dashboard.page.filters.projects')}</S.Label>
                  <S.ProjectsTrigger
                    type="button"
                    onClick={() => onProjectsDrawerOpenChange(true)}
                  >
                    {selectedProjectsLabel}
                  </S.ProjectsTrigger>
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.date')}</S.Label>
                  <S.Range>
                    <DatePickerInput
                      value={fromDate}
                      onChange={onFromDateChange}
                      placeholder={t('dashboard.page.filters.from')}
                    />
                    <DatePickerInput
                      value={toDate}
                      onChange={onToDateChange}
                      placeholder={t('dashboard.page.filters.to')}
                    />
                  </S.Range>
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.note')}</S.Label>
                  <S.Control
                    value={worklogQuery}
                    onChange={(e) => onWorklogQueryChange(e.target.value)}
                    placeholder={t('dashboard.page.filters.searchNote')}
                  />
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.timeActive')}</S.Label>
                  <S.Range>
                    <S.Control
                      value={formFilters.timeActiveMin}
                      onChange={(e) =>
                        onFormFiltersChange({ timeActiveMin: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.timeActiveMax}
                      onChange={(e) =>
                        onFormFiltersChange({ timeActiveMax: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </S.Range>
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.keyboard')}</S.Label>
                  <S.Range>
                    <S.Control
                      value={formFilters.keyboardMin}
                      onChange={(e) =>
                        onFormFiltersChange({ keyboardMin: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.keyboardMax}
                      onChange={(e) =>
                        onFormFiltersChange({ keyboardMax: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </S.Range>
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.mouse')}</S.Label>
                  <S.Range>
                    <S.Control
                      value={formFilters.mouseMin}
                      onChange={(e) =>
                        onFormFiltersChange({ mouseMin: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.mouseMax}
                      onChange={(e) =>
                        onFormFiltersChange({ mouseMax: e.target.value })
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </S.Range>
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.mouseDistance')}</S.Label>
                  <S.Range>
                    <S.Control
                      value={formFilters.mouseDistanceMin}
                      onChange={(e) =>
                        onFormFiltersChange({
                          mouseDistanceMin: e.target.value,
                        })
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.mouseDistanceMax}
                      onChange={(e) =>
                        onFormFiltersChange({
                          mouseDistanceMax: e.target.value,
                        })
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </S.Range>
                </S.Field>
              </S.MobileFilters>

              <S.SheetFooter>
                <S.SheetApply
                  type="button"
                  onClick={() => onFiltersOpenChange(false)}
                >
                  {t('dashboard.page.filters.apply', {
                    defaultValue: 'Apply',
                  })}
                </S.SheetApply>
              </S.SheetFooter>
            </S.Sheet>
          </S.DrawerContent>
        </Drawer.Portal>
      </Drawer.Root>

      <Drawer.Root
        open={projectsDrawerOpen}
        onOpenChange={onProjectsDrawerOpenChange}
      >
        <Drawer.Portal>
          <S.NestedDrawerOverlay />
          <S.NestedDrawerContent>
            <S.Sheet>
              <S.SheetHandle />
              <S.SheetSubTitle>
                {t('dashboard.page.filters.projectsTitle')}
              </S.SheetSubTitle>

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

              <S.SheetFooter>
                <S.SheetApply
                  type="button"
                  onClick={() => onProjectsDrawerOpenChange(false)}
                >
                  {t('dashboard.page.filters.apply', {
                    defaultValue: 'Apply',
                  })}
                </S.SheetApply>
              </S.SheetFooter>
            </S.Sheet>
          </S.NestedDrawerContent>
        </Drawer.Portal>
      </Drawer.Root>
    </S.MobileOnly>
  )
}
