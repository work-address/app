import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'
import { Drawer } from 'vaul'

import type { ProjectRow } from '@/features/dashboard'

import {
  ApplicationsUsage,
  DashboardEmptyState,
  ProjectsNotFound,
  WorklogsTable,
  WorklogsEmptyState,
  ProjectsTable,
  CreateProjectModal,
  DashboardStyles as S,
} from '@/features/dashboard'
import {
  DatePickerInput,
  Wrapper,
  Spinner,
  projectsMock,
  worklogsMock,
  Button,
  IconButton,
} from '@/features/shared'

type TabKey = 'all' | 'active' | 'finished'

export default function DashboardPage() {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('all')
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    all: null,
    active: null,
    finished: null,
  })
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
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

  const [initialized, setInitialized] = useState(false)

  const rows = useMemo(() => {
    let filtered: ProjectRow[] = projectsMock

    if (tab === 'active') {
      filtered = filtered.filter((p) => p.status === 'Active')
    }

    if (tab === 'finished') {
      filtered = filtered.filter((p) => p.status === 'Finished')
    }

    const q = query.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q))
    }

    return filtered
  }, [tab, query])

  const totalCount = projectsMock.length
  const hasProjects = totalCount > 0
  const projectsFound = rows.length > 0

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
    const update = () => {
      const root = tabsRef.current
      const activeEl = tabRefs.current[tab]
      if (!root || !activeEl) {
        return
      }

      const rootBox = root.getBoundingClientRect()
      const tabBox = activeEl.getBoundingClientRect()

      const minWidth = 50
      const w = Math.max(tabBox.width, minWidth)
      const left = tabBox.left - rootBox.left + (tabBox.width - w) / 2

      setIndicator({ left, width: w })
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [tab])

  useEffect(() => {
    setTimeout(() => {
      setInitialized(true)
    }, 350)
  }, [])

  return initialized ? (
    <Wrapper>
      <S.Content>
        <S.Left>
          <S.Top>
            <S.TitleRow>
              <S.TitleBox>
                <S.Title>{t('dashboard.page.title')}</S.Title>
                <S.Counter>
                  {t('dashboard.page.projectsCount', { count: totalCount })}
                </S.Counter>
              </S.TitleBox>

              {hasProjects ? (
                <S.DashboardSearch value={query} onChange={setQuery} />
              ) : (
                <S.TopRight>
                  <S.CreateProjectButton
                    themeVariant="primary"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    <PlusIcon />
                    <S.CreateProjectText>
                      {t('dashboard.page.createProject')}
                    </S.CreateProjectText>
                  </S.CreateProjectButton>
                </S.TopRight>
              )}
            </S.TitleRow>
          </S.Top>

          <>
            <S.TabsRow>
              <S.Tabs ref={tabsRef}>
                <S.ActiveIndicator
                  aria-hidden="true"
                  animate={{ left: indicator.left, width: indicator.width }}
                  transition={{
                    type: 'spring',
                    stiffness: 520,
                    damping: 44,
                  }}
                />
                <S.Tab
                  ref={(el) => {
                    tabRefs.current.all = el
                  }}
                  $active={tab === 'all'}
                  onClick={() => setTab('all')}
                >
                  {t('dashboard.page.tabs.all')}
                </S.Tab>
                <S.Tab
                  ref={(el) => {
                    tabRefs.current.active = el
                  }}
                  $active={tab === 'active'}
                  onClick={() => setTab('active')}
                >
                  {t('dashboard.page.tabs.active')}
                </S.Tab>
                <S.Tab
                  ref={(el) => {
                    tabRefs.current.finished = el
                  }}
                  $active={tab === 'finished'}
                  onClick={() => setTab('finished')}
                >
                  {t('dashboard.page.tabs.finished')}
                </S.Tab>
              </S.Tabs>

              <Flex gap={'var(--space-2)'}>
                {isUpMd ? (
                  <Button variant={'outline'} color={'red'}>
                    <TrashIcon />
                    {t('dashboard.page.deleteAll')}
                  </Button>
                ) : (
                  <IconButton variant={'outline'} color={'red'}>
                    <TrashIcon />
                  </IconButton>
                )}

                {isUpMd ? (
                  <Button
                    onClick={() => setCreateProjectOpen(true)}
                    themeVariant={'primary'}
                  >
                    <PlusIcon />
                    {t('dashboard.page.createProject')}
                  </Button>
                ) : (
                  <IconButton
                    themeVariant={'primary'}
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    <PlusIcon />
                  </IconButton>
                )}
              </Flex>
            </S.TabsRow>

            <S.TableArea>
              {projectsFound ? (
                <ProjectsTable rows={rows} />
              ) : (
                <ProjectsNotFound
                  title={t('dashboard.page.projectsNotFound.title')}
                  description={t('dashboard.page.projectsNotFound.description')}
                  actionLabel={t('dashboard.page.createProject')}
                />
              )}
            </S.TableArea>
          </>

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
    <Flex justify={'center'}>
      <Spinner size={100} style={{ marginTop: 300, textAlign: 'center' }} />
    </Flex>
  )
}
