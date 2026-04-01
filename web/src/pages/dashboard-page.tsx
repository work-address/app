import { useMemo, useState } from 'react'
import styled from 'styled-components'

import type { ProjectRow } from '@/features/dashboard/components'

import {
  ApplicationsUsage,
  DashboardEmptyState,
  ProjectsNotFound,
  WorklogsTable,
  WorklogsEmptyState,
  ProjectsTable,
} from '@/features/dashboard/components'
import {
  Button,
  DatePickerInput,
  MotionSelect,
  Search,
  Wrapper,
} from '@/features/shared'
import { projectsMock } from '@/features/shared/mocks/projects'
import { worklogsMock } from '@/features/shared/mocks/worklogs'

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

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')
  const [worklogQuery, setWorklogQuery] = useState('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [worklogProjects, setWorklogProjects] = useState<string[]>([])

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

  return (
    <Wrapper>
      <Content>
        <Left>
          <Top>
            <TitleRow>
              <TitleBox>
                <Title>Dashboard</Title>
                <Counter>{totalCount} projects</Counter>
              </TitleBox>

              {hasProjects ? (
                <Search value={query} onChange={setQuery} />
              ) : null}
              {hasProjects ? null : (
                <TopRight>
                  <Button>
                    <PlusIcon />
                    Create project
                  </Button>
                </TopRight>
              )}
            </TitleRow>
          </Top>

          {hasProjects ? (
            <>
              {projectsFound ? (
                <TabsRow>
                  <Tabs>
                    <Tab $active={tab === 'all'} onClick={() => setTab('all')}>
                      All
                    </Tab>
                    <Tab
                      $active={tab === 'active'}
                      onClick={() => setTab('active')}
                    >
                      Active
                    </Tab>
                    <Tab
                      $active={tab === 'finished'}
                      onClick={() => setTab('finished')}
                    >
                      Finished
                    </Tab>
                  </Tabs>

                  <Actions>
                    <Button>
                      <PlusIcon />
                      Create project
                    </Button>
                  </Actions>
                </TabsRow>
              ) : null}
              <TableArea>
                {projectsFound ? (
                  <ProjectsTable rows={rows} />
                ) : (
                  <ProjectsNotFound
                    title="No projects found"
                    description="Oops! We couldn’t find any projects matching your search. Try adjusting your keywords or create a new project to get started."
                    actionLabel="Create project"
                  />
                )}
              </TableArea>
            </>
          ) : (
            <DashboardEmptyState
              imageSrc="/img/photo/help.svg"
              title="No projects yet"
              description="No projects yet? No problem! Start tracking time and productivity by creating your first project now."
              actionLabel="Go to Help Centre"
            />
          )}
        </Left>
        {hasProjects ? (
          <Right>
            <ApplicationsUsage />
          </Right>
        ) : null}
      </Content>

      <Section>
        <SectionTitle>Worklogs</SectionTitle>
        {hasWorklogs ? (
          <>
            <Filters>
              <Field $basis={180}>
                <Label>Projects</Label>
                <FilterMotionSelect
                  title="PROJECTS"
                  multi
                  options={[
                    { value: 'project-1', label: 'Project #1' },
                    { value: 'project-2', label: 'Project #2' },
                    { value: 'project-3', label: 'Project #3' },
                    { value: 'project-4', label: 'Project #4' },
                  ]}
                  value={worklogProjects}
                  onChange={(v) => setWorklogProjects(v as string[])}
                  placeholder="All worklogs"
                />
              </Field>

              <Field $basis={200}>
                <Label>Date</Label>
                <Range>
                  <DatePickerInput
                    value={fromDate}
                    onChange={setFromDate}
                    placeholder="From"
                  />
                  <DatePickerInput
                    value={toDate}
                    onChange={setToDate}
                    placeholder="To"
                  />
                </Range>
              </Field>

              <Field $basis={240}>
                <Label>Note</Label>
                <Control
                  value={worklogQuery}
                  onChange={(e) => setWorklogQuery(e.target.value)}
                  placeholder="Search for project note"
                />
              </Field>

              <Field>
                <Label>Time active</Label>
                <Range>
                  <Control placeholder="Min" />
                  <Control placeholder="Max" />
                </Range>
              </Field>

              <Field>
                <Label>Keyboard</Label>
                <Range>
                  <Control placeholder="Min" />
                  <Control placeholder="Max" />
                </Range>
              </Field>

              <Field>
                <Label>Mouse</Label>
                <Range>
                  <Control placeholder="Min" />
                  <Control placeholder="Max" />
                </Range>
              </Field>

              <Field>
                <Label>Mouse distance</Label>
                <Range>
                  <Control placeholder="Min" />
                  <Control placeholder="Max" />
                </Range>
              </Field>
            </Filters>
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
  justify-content: space-between;
  width: 100%;
  gap: 10px;
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
`

const Tabs = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`

const Tab = styled.button<{ $active?: boolean }>`
  padding: 8px 0;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  color: ${(p) => (p.$active ? 'var(--primary)' : 'rgba(28, 32, 36, 0.62)')};
  border-bottom: 2px solid
    ${(p) => (p.$active ? 'var(--download, #003482)' : 'transparent')};

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
    grid-template-columns: 65% 35%;
  }
`

const Left = styled.section`
  min-width: 0;
`

const Right = styled.section`
  min-width: 0;
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
  margin: 0 0 14px;
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
  flex: 1 1 ${(p) => (p.$basis ? `${p.$basis}px` : '100px')};
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
