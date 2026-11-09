import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { ITeam, ITeamAgent, ITeamPerson, ITeamProject } from '@/model/team'
import { TeamRepository } from '@/repository/team-repository'
import { Collaborators, ICollaborator } from '@/service/collaborators'
import { ProjectRole } from '@/service/project-access'

/**
 * Who is on each project and which agents they run, as `reader` may see it
 * (SPEC.md, "Who can see what"): an owner every worker's agents and rates, a
 * worker only their own, a viewer no team view at all.
 */
@injectable()
export class TeamManager {
  @inject('TeamRepository') private repository: TeamRepository
  @inject('Collaborators') private collaborators: Collaborators

  public async read(reader: User): Promise<ITeam> {
    const projects = await this.repository.projects(reader, 'worker')
    if (!projects.length) {
      const listed = await this.repository.projects(reader, 'viewer')
      return { viewerOnly: listed.length > 0, projects: [] }
    }
    const people = await this.collaborators.of(projects)
    return {
      viewerOnly: false,
      projects: projects.map((project) =>
        TeamManager.project(project, reader, people.get(project.id) ?? []),
      ),
    }
  }

  private static project(
    project: Project,
    reader: User,
    listed: ICollaborator[],
  ): ITeamProject {
    return {
      id: project.id,
      title: project.title,
      state: project.state,
      role: project.isOwner(reader) ? 'owner' : 'worker',
      trackAgents: project.trackAgents,
      people: [
        TeamManager.person(
          project,
          reader,
          project.user.address,
          'owner',
          project.user,
        ),
        ...listed.map(({ address, role, account }) =>
          TeamManager.person(project, reader, address, role, account),
        ),
      ],
    }
  }

  private static person(
    project: Project,
    reader: User,
    address: string,
    role: ProjectRole,
    account: User | undefined,
  ): ITeamPerson {
    const seesAgents =
      role !== 'viewer' &&
      account !== undefined &&
      (project.isOwner(reader) || account.id === reader.id)
    return {
      address,
      userId: account?.id ?? null,
      name: account?.name || null,
      role,
      agents: seesAgents ? TeamManager.agents(project, account) : [],
    }
  }

  /** A detached agent, or one its worker removed, is no longer on the project. */
  private static agents(project: Project, worker: User): ITeamAgent[] {
    return (project.agentAttachments ?? []).flatMap((attachment) => {
      const agent = worker.agents?.find((a) => a.id === attachment.agentId)
      if (
        attachment.workerId !== worker.id ||
        attachment.detachedAt ||
        !agent ||
        agent.removedAt
      )
        return []
      const change = attachment.rateChanges[attachment.rateChanges.length - 1]
      return [
        {
          id: agent.id,
          name: agent.name,
          product: agent.product,
          rateHourCents: attachment.rateHourCents,
          attachedAt: attachment.attachedAt,
          lastRateChange: change
            ? {
                at: change.at,
                fromCents: change.fromCents,
                toCents: change.toCents,
              }
            : null,
        },
      ]
    })
  }
}
