import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
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
} from '@/features/dashboard'
import {
  Button,
  DatePickerInput,
  MotionSelect,
  Search,
  Wrapper,
} from '@/features/shared'
import { projectsMock, worklogsMock } from '@/features/shared'

type TabKey = 'all' | 'active' | 'finished'

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Dashboard() {
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

  return (
    <Wrapper>
      <Content>
        <Left>
          <Top>
            <TitleRow>
              <TitleBox>
                <Title>{t('dashboard.page.title')}</Title>
                <Counter>
                  {t('dashboard.page.projectsCount', { count: totalCount })}
                </Counter>
              </TitleBox>

              {hasProjects ? (
                <DashboardSearch value={query} onChange={setQuery} />
              ) : null}
              {hasProjects ? null : (
                <TopRight>
                  <CreateProjectButton
                    type="button"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    <PlusIcon />
                    <CreateProjectText>
                      {t('dashboard.page.createProject')}
                    </CreateProjectText>
                  </CreateProjectButton>
                </TopRight>
              )}
            </TitleRow>
          </Top>

          {hasProjects ? (
            <>
              {projectsFound ? (
                <TabsRow>
                  <Tabs ref={tabsRef}>
                    <ActiveIndicator
                      aria-hidden="true"
                      animate={{ left: indicator.left, width: indicator.width }}
                      transition={{
                        type: 'spring',
                        stiffness: 520,
                        damping: 44,
                      }}
                    />
                    <Tab
                      ref={(el) => {
                        tabRefs.current.all = el
                      }}
                      $active={tab === 'all'}
                      onClick={() => setTab('all')}
                    >
                      {t('dashboard.page.tabs.all')}
                    </Tab>
                    <Tab
                      ref={(el) => {
                        tabRefs.current.active = el
                      }}
                      $active={tab === 'active'}
                      onClick={() => setTab('active')}
                    >
                      {t('dashboard.page.tabs.active')}
                    </Tab>
                    <Tab
                      ref={(el) => {
                        tabRefs.current.finished = el
                      }}
                      $active={tab === 'finished'}
                      onClick={() => setTab('finished')}
                    >
                      {t('dashboard.page.tabs.finished')}
                    </Tab>
                  </Tabs>

                  <Actions>
                    <CreateProjectButton
                      type="button"
                      onClick={() => setCreateProjectOpen(true)}
                    >
                      <PlusIcon />
                      <CreateProjectText>
                        {t('dashboard.page.createProject')}
                      </CreateProjectText>
                    </CreateProjectButton>
                  </Actions>
                </TabsRow>
              ) : null}
              <TableArea>
                {projectsFound ? (
                  <ProjectsTable rows={rows} />
                ) : (
                  <ProjectsNotFound
                    title={t('dashboard.page.projectsNotFound.title')}
                    description={t(
                      'dashboard.page.projectsNotFound.description',
                    )}
                    actionLabel={t('dashboard.page.createProject')}
                  />
                )}
              </TableArea>
            </>
          ) : (
            <DashboardEmptyState
              imageSrc="/img/photo/help.svg"
              title={t('dashboard.page.empty.title')}
              description={t('dashboard.page.empty.description')}
              actionLabel={t('dashboard.page.empty.action')}
            />
          )}
        </Left>
        {hasProjects ? (
          <Right>
            <ApplicationsUsage />
          </Right>
        ) : null}
      </Content>

      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreate={() => {
          // TODO: wire to actual create project API/state
        }}
      />

      <Section>
        <SectionTitleRow>
          <SectionTitle>{t('dashboard.page.worklogs.title')}</SectionTitle>
          {hasWorklogs ? (
            <MobileOnly>
              <Drawer.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
                <Drawer.Trigger asChild>
                  <FiltersButton type="button">
                    <FilterImage
                      src="/img/icons/filter-icon.svg"
                      alt="Filter"
                      width={20}
                      height={20}
                    />
                    {t('dashboard.page.filters.title', {
                      defaultValue: 'Filters',
                    })}
                  </FiltersButton>
                </Drawer.Trigger>
                <Drawer.Portal>
                  <DrawerOverlay />
                  <DrawerContent>
                    <Sheet>
                      <SheetHandle />
                      <SheetTitle>
                        {t('dashboard.page.filters.title', {
                          defaultValue: 'Filters',
                        })}
                      </SheetTitle>

                      <MobileFilters>
                        <Field>
                          <Label>{t('dashboard.page.filters.projects')}</Label>
                          <ProjectsTrigger
                            type="button"
                            onClick={() => setProjectsDrawerOpen(true)}
                          >
                            {selectedProjectsLabel}
                          </ProjectsTrigger>
                        </Field>

                        <Field>
                          <Label>{t('dashboard.page.filters.date')}</Label>
                          <Range>
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
                          </Range>
                        </Field>

                        <Field>
                          <Label>{t('dashboard.page.filters.note')}</Label>
                          <Control
                            value={worklogQuery}
                            onChange={(e) => setWorklogQuery(e.target.value)}
                            placeholder={t('dashboard.page.filters.searchNote')}
                          />
                        </Field>

                        <Field>
                          <Label>
                            {t('dashboard.page.filters.timeActive')}
                          </Label>
                          <Range>
                            <Control
                              value={formFilters.timeActiveMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  timeActiveMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <Control
                              value={formFilters.timeActiveMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  timeActiveMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </Range>
                        </Field>

                        <Field>
                          <Label>{t('dashboard.page.filters.keyboard')}</Label>
                          <Range>
                            <Control
                              value={formFilters.keyboardMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  keyboardMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <Control
                              value={formFilters.keyboardMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  keyboardMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </Range>
                        </Field>

                        <Field>
                          <Label>{t('dashboard.page.filters.mouse')}</Label>
                          <Range>
                            <Control
                              value={formFilters.mouseMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <Control
                              value={formFilters.mouseMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </Range>
                        </Field>

                        <Field>
                          <Label>
                            {t('dashboard.page.filters.mouseDistance')}
                          </Label>
                          <Range>
                            <Control
                              value={formFilters.mouseDistanceMin}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseDistanceMin: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.min')}
                            />
                            <Control
                              value={formFilters.mouseDistanceMax}
                              onChange={(e) =>
                                setFormFilters((p) => ({
                                  ...p,
                                  mouseDistanceMax: e.target.value,
                                }))
                              }
                              placeholder={t('dashboard.page.filters.max')}
                            />
                          </Range>
                        </Field>
                      </MobileFilters>

                      <SheetFooter>
                        <SheetApply
                          type="button"
                          onClick={() => setFiltersOpen(false)}
                        >
                          {t('dashboard.page.filters.apply', {
                            defaultValue: 'Apply',
                          })}
                        </SheetApply>
                      </SheetFooter>
                    </Sheet>
                  </DrawerContent>
                </Drawer.Portal>
              </Drawer.Root>

              <Drawer.Root
                open={projectsDrawerOpen}
                onOpenChange={setProjectsDrawerOpen}
              >
                <Drawer.Portal>
                  <NestedDrawerOverlay />
                  <NestedDrawerContent>
                    <Sheet>
                      <SheetHandle />
                      <SheetSubTitle>
                        {t('dashboard.page.filters.projectsTitle')}
                      </SheetSubTitle>

                      <ProjectsList>
                        {projectOptions.map((opt) => {
                          const selected = worklogProjects.includes(opt.value)
                          return (
                            <ProjectRowButton
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
                              <ProjectRowLabel>{opt.label}</ProjectRowLabel>
                              {selected ? <CheckIcon aria-hidden /> : null}
                            </ProjectRowButton>
                          )
                        })}
                      </ProjectsList>

                      <SheetFooter>
                        <SheetApply
                          type="button"
                          onClick={() => setProjectsDrawerOpen(false)}
                        >
                          {t('dashboard.page.filters.apply', {
                            defaultValue: 'Apply',
                          })}
                        </SheetApply>
                      </SheetFooter>
                    </Sheet>
                  </NestedDrawerContent>
                </Drawer.Portal>
              </Drawer.Root>
            </MobileOnly>
          ) : null}
        </SectionTitleRow>
        {hasWorklogs ? (
          <>
            <DesktopOnly>
              <Filters>
                <Field $basis={180}>
                  <Label>{t('dashboard.page.filters.projects')}</Label>
                  <FilterMotionSelect
                    title={t('dashboard.page.filters.projectsTitle')}
                    multi
                    options={projectOptions}
                    value={worklogProjects}
                    onChange={(v) => setWorklogProjects(v as string[])}
                    placeholder={t('dashboard.page.filters.allWorklogs')}
                  />
                </Field>

                <Field $basis={200}>
                  <Label>{t('dashboard.page.filters.date')}</Label>
                  <Range>
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
                  </Range>
                </Field>

                <Field $basis={240}>
                  <Label>{t('dashboard.page.filters.note')}</Label>
                  <Control
                    value={worklogQuery}
                    onChange={(e) => setWorklogQuery(e.target.value)}
                    placeholder={t('dashboard.page.filters.searchNote')}
                  />
                </Field>

                <Field>
                  <Label>{t('dashboard.page.filters.timeActive')}</Label>
                  <Range>
                    <Control
                      value={formFilters.timeActiveMin}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          timeActiveMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <Control
                      value={formFilters.timeActiveMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          timeActiveMax: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </Range>
                </Field>

                <Field>
                  <Label>{t('dashboard.page.filters.keyboard')}</Label>
                  <Range>
                    <Control
                      value={formFilters.keyboardMin}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          keyboardMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <Control
                      value={formFilters.keyboardMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          keyboardMax: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </Range>
                </Field>

                <Field>
                  <Label>{t('dashboard.page.filters.mouse')}</Label>
                  <Range>
                    <Control
                      value={formFilters.mouseMin}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <Control
                      value={formFilters.mouseMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseMax: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </Range>
                </Field>

                <Field>
                  <Label>{t('dashboard.page.filters.mouseDistance')}</Label>
                  <Range>
                    <Control
                      value={formFilters.mouseDistanceMin}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseDistanceMin: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.min')}
                    />
                    <Control
                      value={formFilters.mouseDistanceMax}
                      onChange={(e) =>
                        setFormFilters((p) => ({
                          ...p,
                          mouseDistanceMax: e.target.value,
                        }))
                      }
                      placeholder={t('dashboard.page.filters.max')}
                    />
                  </Range>
                </Field>
              </Filters>
            </DesktopOnly>
            <WorklogsTable rows={worklogRows} />
          </>
        ) : (
          <WorklogsEmptyState />
        )}
      </Section>
    </Wrapper>
  )
}

const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
`

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  /* justify-content: space-between; */
  width: 100%;
  gap: 10px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: start;
  }
`

const TopRight = styled.div`
  margin-left: auto;
`

const TitleBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const Title = styled.h1`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: #1c2024;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

const Counter = styled.span`
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 500;
  font-size: 12px;
  line-height: 133%;
  color: rgba(0, 7, 20, 0.62);
  background: rgba(0, 0, 51, 0.06);
`

const DashboardSearch = styled(Search)`
  width: 280px;
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`

const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  margin-left: 20px;
`

const Tabs = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid rgba(0, 8, 48, 0.12);
`

const ActiveIndicator = styled(motion.div)`
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: var(--download, #003482);
  pointer-events: none;
`

const Tab = styled.button<{ $active?: boolean }>`
  padding: 8px 0;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  color: ${(p) => (p.$active ? 'var(--primary)' : 'rgba(28, 32, 36, 0.62)')};
  border-bottom: 2px solid transparent;

  &:hover {
    color: var(--primary);
  }
`

const TableArea = styled.div`
  padding-top: 4px;
`

const Content = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;

  &:has(> :nth-child(2)) {
    grid-template-columns: 64% 35%;
  }
`

const Left = styled.section`
  min-width: 0;

  @media (max-width: 1024px) {
    grid-column: 1 / -1;
    padding-right: 8px;
  }
`

const Right = styled.section`
  min-width: 0;

  @media (max-width: 1024px) {
    display: none;
  }
`

const Section = styled.section`
  margin-top: 48px;
`

const SectionTitle = styled.h2`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: #1c2024;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

const CreateProjectButton = styled(Button)`
  @media (max-width: 768px) {
    padding: 6px 10px;
    gap: 0;

    svg {
      width: 18px;
      height: 18px;
    }
  }
`

const CreateProjectText = styled.span`
  @media (max-width: 768px) {
    display: none;
  }
`

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`

const DesktopOnly = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`

const MobileOnly = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`

const FiltersButton = styled.button`
  font-weight: 500;
  font-size: 12px;
  line-height: 133%;
  letter-spacing: 0em;
  color: #60646c;
  border: 1px solid rgba(0, 8, 48, 0.27);
  border-radius: 3px;
  padding: 0px 8px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  img {
    width: 16px;
    height: 16px;
    display: block;
  }

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const FilterImage = styled.img`
  width: 16px;
  height: 16px;
  display: block;
`

const DrawerOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 50;
`

const DrawerContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 51;
  outline: none;
`

const NestedDrawerOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 60;
`

const NestedDrawerContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  outline: none;
`

const Sheet = styled.div`
  background: #fff;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  padding: 16px;
  max-height: 85vh;
  overflow: auto;
`

const SheetHandle = styled.div`
  width: 48px;
  height: 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 auto 10px;
`

const SheetTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  text-align: center;
  margin-bottom: 12px;
`

const SheetSubTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 12px;
`

const MobileFilters = styled.div`
  display: flex;
  flex-direction: column;
  /* gap: 12px; */
`

const SheetFooter = styled.div`
  margin-top: 14px;
`

const SheetApply = styled.button`
  width: 100%;
  height: 32px;
  border-radius: 4px;
  background: #3f67a4;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
`

const ProjectsTrigger = styled.button`
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
  color: var(--primary);
  text-align: left;
`

const ProjectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ProjectRowButton = styled.button<{ $selected?: boolean }>`
  width: 100%;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${(p) => (p.$selected ? 'rgba(5, 86, 205, 0.0588)' : '')};

  &:hover {
    background: rgba(0, 0, 0, 0.08);
  }
`

const ProjectRowLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #1c2024;
`

const CheckIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  background: url('/img/icons/check-icon.svg') no-repeat center;
  background-size: contain;
`

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  margin-bottom: 10px;
`

const FilterMotionSelect = styled(MotionSelect)`
  --ms-height: 34px;
`

const Field = styled.div<{ $basis?: number }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 ${(p) => (p.$basis ? `${p.$basis}px` : '70px')};
  min-width: 130px;
`

const Label = styled.div`
  font-size: 14px;
  line-height: 14px;
  color: #1c2024;
  font-weight: 500;
`

const Control = styled.input`
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
  color: var(--primary);
  outline: none;

  &::placeholder {
    color: rgba(0, 5, 29, 0.45);
  }

  &:focus {
    border-color: rgba(0, 52, 130, 0.55);
  }
`

const Range = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`
