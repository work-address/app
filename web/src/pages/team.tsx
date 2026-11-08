import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'

import { fetchProjects } from '@/entities/projects'
import { ProjectsPeopleDialog } from '@/features/projects'
import {
  $canSeeTeam,
  $teamLoading,
  fetchTeam,
  TeamProject,
  teamQuery,
  TeamYourAgents,
} from '@/features/team'
import { routes } from '@/routes'
import {
  PageHelmet,
  RouteSkeleton,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from '@/shared'

export default function TeamPage() {
  const { t } = useTranslation()
  const { team, loading, failed, canSee, fetchTeamEvent, fetchProjectsEvent } =
    useUnit({
      team: teamQuery.$data,
      loading: $teamLoading,
      failed: teamQuery.$failed,
      canSee: $canSeeTeam,
      fetchTeamEvent: fetchTeam,
      fetchProjectsEvent: fetchProjects,
    })

  // Changing a project's lists saves the whole project, which the team omits.
  useEffect(() => {
    fetchTeamEvent()
    fetchProjectsEvent()
  }, [fetchTeamEvent, fetchProjectsEvent])

  if (!canSee) {
    return <Navigate to={routes.dashboard.build()} replace />
  }

  if (loading) {
    return <RouteSkeleton variant="document" />
  }

  return (
    <Root>
      <PageHelmet
        title={t('team.page.title')}
        description={t('team.page.meta')}
      />
      <WorkspacePageHeader
        title={t('team.page.title')}
        description={t('team.page.description')}
      />
      <TeamYourAgents />
      {failed ? (
        <WorkspacePanel
          title={t('team.projects.title')}
          failed
          onRetry={fetchTeamEvent}
        >
          {null}
        </WorkspacePanel>
      ) : (
        team?.projects.map((project) => (
          <TeamProject
            key={project.id}
            project={project}
            actions={
              project.role === 'owner' ? (
                <ProjectsPeopleDialog projectId={project.id} />
              ) : undefined
            }
          />
        ))
      )}
    </Root>
  )
}

const Root = styled(WorkspacePage)`
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);
`
