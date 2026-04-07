import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'
import { Drawer } from 'vaul'

import {
  ApplicationsUsage,
  DashboardEmptyState,
  WorklogsTable,
  WorklogsEmptyState,
  ProjectsTable,
  CreateProjectModal,
  DashboardStyles as S,
} from '@/features/dashboard'
import { Button, Text } from '@/features/shared'
import {
  DatePickerInput,
  Wrapper,
  Spinner,
  worklogsMock,
} from '@/features/shared'

export default function DashboardPage() {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const { t } = useTranslation()

  const [query, setQuery] = useState('')
  const [worklogQuery, setWorklogQuery] = useState('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [worklogProjects, setWorklogProjects] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [projectsDrawerOpen, setProjectsDrawerOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [formFilters, setFormFilters] = useState({
    timeActiveMin: '',
    timeActiveMax: '',
    keyboardMin: '',
    keyboardMax: '',
    mouseMin: '',
    mouseMax: '',
    mouseDistanceMin: '',
    mouseDistanceMax: '',
  })

  const hasProjects = true

  const [initialized, setInitialized] = useState(false)

  const worklogRows = useMemo(() => {
    return worklogsMock.filter((w) => {
      const q = worklogQuery.trim().toLowerCase()
      if (!q) {
        return true
      }
      return w.note.toLowerCase().includes(q)
    })
  }, [worklogQuery])

  const hasWorklogs = worklogRows.length > 0

  const projectOptions = useMemo(
    () => [
      {
        value: 'project-1',
        label: t('dashboard.page.filters.projectOption', { number: 1 }),
      },
      {
        value: 'project-2',
        label: t('dashboard.page.filters.projectOption', { number: 2 }),
      },
      {
        value: 'project-3',
        label: t('dashboard.page.filters.projectOption', { number: 3 }),
      },
      {
        value: 'project-4',
        label: t('dashboard.page.filters.projectOption', { number: 4 }),
      },
    ],
    [t],
  )

  const selectedProjectsLabel = useMemo(() => {
    if (worklogProjects.length === 0) {
      return t('dashboard.page.filters.allWorklogs')
    }
    const selected = projectOptions
      .filter((o) => worklogProjects.includes(o.value))
      .map((o) => o.label)

    return selected.length <= 2
      ? selected.join(', ')
      : `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`
  }, [projectOptions, t, worklogProjects])

  useEffect(() => {
    setTimeout(() => {
      setInitialized(true)
    }, 700)
  }, [])

  return initialized ? (
    <Wrapper>
      <S.Content>
        <S.Left>
          <S.Top>
            <S.TitleRow>
              <Flex align={'center'} gap={'10px'}>
                <Text size={isUpMd ? '6' : '4'} weight={'medium'}>
                  {t('dashboard.page.title')}
                </Text>
                <Badge size={'2'} color={'gray'}>
                  <Text weight={'medium'} size={'1'}>
                    {t('dashboard.page.projectsCount', { count: 4 })}
                  </Text>
                </Badge>
              </Flex>

              {hasProjects ? (
                <S.DashboardSearch value={query} onChange={setQuery} />
              ) : (
                <S.TopRight>
                  <Button
                    themeVariant="primary"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    <PlusIcon />
                    <S.CreateProjectText>
                      {t('dashboard.page.createProject')}
                    </S.CreateProjectText>
                  </Button>
                </S.TopRight>
              )}
            </S.TitleRow>
          </S.Top>

          <S.TableArea>
            <ProjectsTable />
          </S.TableArea>

          {!hasProjects && (
            <DashboardEmptyState
              imageSrc="/img/photo/help.svg"
              title={t('dashboard.page.empty.title')}
              description={t('dashboard.page.empty.description')}
              actionLabel={t('dashboard.page.empty.action')}
            />
          )}
        </S.Left>

        {hasProjects && (
          <S.Right>
            <ApplicationsUsage />
          </S.Right>
        )}
      </S.Content>

      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreate={() => {
          // TODO: wire to actual create project API/state
        }}
      />

      <S.Section>
        <S.SectionTitleRow>
          <S.SectionTitle>{t('dashboard.page.worklogs.title')}</S.SectionTitle>

          {hasWorklogs ? (
            <S.MobileOnly>
              <Drawer.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
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
                          <S.Label>
                            {t('dashboard.page.filters.projects')}
                          </S.Label>
                          <S.ProjectsTrigger
                            type="button"
                            onClick={() => setProjectsDrawerOpen(true)}
                          >
                            {selectedProjectsLabel}
                          </S.ProjectsTrigger>
                        </S.Field>

                        <S.Field>
                          <S.Label>{t('dashboard.page.filters.date')}</S.Label>
                          <S.Range>
                            <DatePickerInput
                              value={fromDate}
                              onChange={setFromDate}
                              placeholder={t('dashboard.page.filters.from')}
                            />
                            <DatePickerInput
                              value={toDate}
                              onChange={setToDate}
                              placeholder={t('dashboard.page.filters.to')}
                            />
                          </S.Range>
                        </S.Field>

                        <S.Field>
                          <S.Label>{t('dashboard.page.filters.note')}</S.Label>
                          <S.Control
                            value={worklogQuery}
                            onChange={(e) => setWorklogQuery(e.target.value)}
                            placeholder={t('dashboard.page.filters.searchNote')}
                          />
                        </S.Field>

                        <S.Field>
                          <S.Label>
                            {t('dashboard.page.filters.timeActive')}
                          </S.Label>
                          <S.Range>
                            <S.Control
                              value={formFilters.timeActiveMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  timeActiveMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <S.Control
                              value={formFilters.timeActiveMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  timeActiveMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </S.Range>
                        </S.Field>

                        <S.Field>
                          <S.Label>
                            {t('dashboard.page.filters.keyboard')}
                          </S.Label>
                          <S.Range>
                            <S.Control
                              value={formFilters.keyboardMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  keyboardMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <S.Control
                              value={formFilters.keyboardMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  keyboardMax: e.target.value,
                                }))
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
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <S.Control
                              value={formFilters.mouseMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </S.Range>
                        </S.Field>

                        <S.Field>
                          <S.Label>
                            {t('dashboard.page.filters.mouseDistance')}
                          </S.Label>
                          <S.Range>
                            <S.Control
                              value={formFilters.mouseDistanceMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseDistanceMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <S.Control
                              value={formFilters.mouseDistanceMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseDistanceMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </S.Range>
                        </S.Field>
                      </S.MobileFilters>

                      <S.SheetFooter>
                        <S.SheetApply
                          type="button"
                          onClick={() => setFiltersOpen(false)}
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
                onOpenChange={setProjectsDrawerOpen}
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
                              onClick={() =>
                                setWorklogProjects((prev) =>
                                  prev.includes(opt.value)
                                    ? prev.filter((v) => v !== opt.value)
                                    : [...prev, opt.value],
                                )
                              }
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
                          onClick={() => setProjectsDrawerOpen(false)}
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
          ) : null}
        </S.SectionTitleRow>

        {hasWorklogs ? (
          <>
            <S.DesktopOnly>
              <S.Filters>
                <S.Field $basis={180}>
                  <S.Label>{t('dashboard.page.filters.projects')}</S.Label>
                  <S.FilterMotionSelect
                    title={t('dashboard.page.filters.projectsTitle')}
                    multi
                    options={projectOptions}
                    value={worklogProjects}
                    onChange={(v) => setWorklogProjects(v as string[])}
                    placeholder={t('dashboard.page.filters.allWorklogs')}
                  />
                </S.Field>

                <S.Field $basis={200}>
                  <S.Label>{t('dashboard.page.filters.date')}</S.Label>
                  <S.Range>
                    <DatePickerInput
                      value={fromDate}
                      onChange={setFromDate}
                      placeholder={t('dashboard.page.filters.from')}
                    />
                    <DatePickerInput
                      value={toDate}
                      onChange={setToDate}
                      placeholder={t('dashboard.page.filters.to')}
                    />
                  </S.Range>
                </S.Field>

                <S.Field $basis={240}>
                  <S.Label>{t('dashboard.page.filters.note')}</S.Label>
                  <S.Control
                    value={worklogQuery}
                    onChange={(e) => setWorklogQuery(e.target.value)}
                    placeholder={t('dashboard.page.filters.searchNote')}
                  />
                </S.Field>

                <S.Field>
                  <S.Label>{t('dashboard.page.filters.timeActive')}</S.Label>
                  <S.Range>
                    <S.Control
                      value={formFilters.timeActiveMin}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          timeActiveMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.timeActiveMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          timeActiveMax: e.target.value,
                        }))
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
                        setFormFilters((p) => ({
                          ...p,
                          keyboardMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.keyboardMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          keyboardMax: e.target.value,
                        }))
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
                        setFormFilters((p) => ({
                          ...p,
                          mouseMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.mouseMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseMax: e.target.value,
                        }))
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
                        setFormFilters((p) => ({
                          ...p,
                          mouseDistanceMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <S.Control
                      value={formFilters.mouseDistanceMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseDistanceMax: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </S.Range>
                </S.Field>
              </S.Filters>
            </S.DesktopOnly>
            <WorklogsTable rows={worklogRows} />
          </>
        ) : (
          <WorklogsEmptyState />
        )}
      </S.Section>
    </Wrapper>
  ) : (
    <Flex justify={'center'} align="center" height={'80vh'}>
      <Spinner size={100} />
    </Flex>
  )
}
