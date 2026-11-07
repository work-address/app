import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
} from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProjectsOverviewRow } from './projects-overview-row'

import type { ProjectSort } from '../../model'
import type { ProjectWithStats } from '@/entities/projects'
import type { ReactNode } from 'react'

import { usePageBusy, workspaceDesign } from '@/shared'

type Props = {
  projects: ProjectWithStats[]
  loading: boolean
  isFiltering: boolean
  sort: ProjectSort
  onSortChange: (sort: ProjectSort) => void
  onOpen: (project: ProjectWithStats) => void
  projectPopup?: (project: ProjectWithStats) => ReactNode
}

/** Period figures supplied by the controller, presented as a project overview. */
export const ProjectsOverviewTable = ({
  projects,
  loading,
  isFiltering,
  sort,
  onSortChange,
  onOpen,
  projectPopup,
}: Props) => {
  const { t } = useTranslation()
  usePageBusy(isFiltering)
  const showDetail =
    loading || projects.some((project) => project.role !== 'viewer')
  const changeSort = (field: 'title' | 'timeTotal') =>
    onSortChange({ [field]: sort[field] === 'ASC' ? 'DESC' : 'ASC' })
  const sortIcon = (field: 'title' | 'timeTotal') => {
    if (sort[field] === 'ASC') {
      return <ArrowUpIcon aria-hidden="true" />
    }
    if (sort[field] === 'DESC') {
      return <ArrowDownIcon aria-hidden="true" />
    }
    return <CaretSortIcon aria-hidden="true" />
  }
  const sortDirection = (field: 'title' | 'timeTotal') =>
    sort[field] === 'ASC'
      ? 'ascending'
      : sort[field] === 'DESC'
        ? 'descending'
        : 'none'

  return (
    <Root
      role="table"
      aria-label={t('dashboard.page.projects.title')}
      aria-busy={loading || isFiltering}
      data-detail={showDetail || undefined}
    >
      <Header role="rowgroup">
        <tr role="row">
          <Heading scope="col" aria-sort={sortDirection('title')}>
            <SortButton type="button" onClick={() => changeSort('title')}>
              {t('dashboard.projectsTable.head.projectName')}
              {sortIcon('title')}
            </SortButton>
          </Heading>
          <Heading scope="col" aria-sort={sortDirection('timeTotal')}>
            <SortButton type="button" onClick={() => changeSort('timeTotal')}>
              {t('dashboard.projectsTable.head.tracked')}
              {sortIcon('timeTotal')}
            </SortButton>
          </Heading>
          {showDetail && (
            <>
              <Heading scope="col">
                {t('dashboard.summary.active.label')}
              </Heading>
              <Heading scope="col">
                {t('dashboard.summary.earned.label')}
              </Heading>
            </>
          )}
        </tr>
      </Header>
      <Body role="rowgroup">
        {loading
          ? [0, 1, 2].map((index) => (
              <Placeholder key={index} role="row">
                <td>
                  <Skeleton width="75%" height="var(--ui-space-7)" />
                </td>
                <td>
                  <Skeleton width="80%" height="var(--ui-meta-line-height)" />
                </td>
                <td>
                  <Skeleton width="50%" height="var(--ui-meta-line-height)" />
                </td>
                <td>
                  <Skeleton width="80%" height="var(--ui-meta-line-height)" />
                </td>
              </Placeholder>
            ))
          : projects.map((project) => (
              <ProjectsOverviewRow
                key={project.id ?? project.title}
                project={project}
                showDetail={showDetail}
                onOpen={onOpen}
                projectPopup={projectPopup}
              />
            ))}
      </Body>
    </Root>
  )
}

const Root = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    display: block;
  }

  @media print {
    break-inside: avoid;
  }
`

const Header = styled.thead`
  ${(p) => p.theme.breakpoints.down('md')} {
    /* The controller retains its visible sort selector on compact screens. */
    display: none;
  }
`

const Heading = styled.th`
  padding: 0 var(--ui-space-3) var(--ui-space-4);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  font-weight: var(--ui-weight-regular);
  text-align: left;
  white-space: nowrap;

  &:first-child {
    width: 60%;
  }

  ${Root}[data-detail] &:first-child {
    width: 46%;
  }

  ${Root}[data-detail] &:nth-child(2) {
    width: 22%;
  }

  ${Root}[data-detail] &:nth-child(3) {
    width: 14%;
  }

  &:last-child {
    text-align: right;
  }

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    padding-inline: var(--ui-space-2);

    ${Root}[data-detail] &:first-child {
      width: 44%;
    }

    ${Root}[data-detail] &:last-child {
      width: 20%;
    }
  }

  @container projects-table (max-width: ${workspaceDesign.container.narrow}px) {
    &:first-child {
      padding-left: 0;
    }

    &:last-child {
      padding-right: 0;
    }

    ${Root}[data-detail] &:first-child {
      width: 48%;
    }

    ${Root}[data-detail] &:nth-child(2) {
      width: 20%;
    }

    ${Root}[data-detail] &:nth-child(3) {
      width: 12%;
    }
  }
`

const SortButton = styled.button`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1) 0;
  border-radius: var(--ui-inline-radius);
  color: inherit;
  font: inherit;
  text-align: inherit;

  &:hover {
    color: var(--ui-blue);
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset-loose);
  }
`

const Body = styled.tbody`
  ${(p) => p.theme.breakpoints.down('md')} {
    display: grid;
  }
`

const Placeholder = styled.tr`
  td {
    padding: var(--ui-space-4) var(--ui-space-3);
    border-top: var(--ui-border-width) solid var(--ui-line);
  }

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    td {
      padding: var(--ui-space-3) var(--ui-space-2);
    }
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: var(--ui-space-4) 0;
    gap: var(--ui-space-3);
    border-top: var(--ui-border-width) solid var(--ui-line);

    td {
      padding: 0;
      border-top: 0;
    }

    td:first-child {
      grid-column: 1 / -1;
    }
  }
`
