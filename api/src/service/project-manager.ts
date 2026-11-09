import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'

import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { ProjectAccessAddresses } from '@/model/dto/project'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { AccountAddress } from '@/service/account-address'
import { Plan } from '@/service/plan'
import { fromPromise } from '@/service/effect-bridge'

@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('Plan')
  protected plan: Plan

  public findProjectCheckAccess(
    project: Project,
    user: User,
  ): RepoEffect<Project | undefined> {
    return this.projectRepository.findProjectWithAccess(project, user)
  }

  public close(project: Project): RepoEffect<void> {
    project.state = EProjectState.INACTIVE

    return this.plan
      .aroundListChange(project.user?.id, this.save(project))
      .pipe(Effect.asVoid)
  }

  public createAndSave(data: Project): RepoEffect<Project> {
    return Effect.gen(this, function* () {
      if (
        data.workerAddresses !== undefined ||
        data.viewerAddresses !== undefined
      ) {
        // A brand new project grants from nothing, so every address in the
        // payload counts as a grant.
        yield* this.setAccessAddresses(
          data,
          {
            workerAddresses: data.workerAddresses ?? [],
            viewerAddresses: data.viewerAddresses ?? [],
          },
          { workerAddresses: [], viewerAddresses: [] },
        )
      }

      delete (data as Partial<Project>).agents
      delete (data as Partial<Project>).agentAttachments
      data.agentTrackingSince = data.trackAgents ? new Date() : null
      return yield* this.plan.aroundListChange(data.user?.id, this.save(data))
    })
  }

  public editAndSave(project: Project, data: Project): RepoEffect<void> {
    return Effect.gen(this, function* () {
      if (
        data.workerAddresses !== undefined ||
        data.viewerAddresses !== undefined
      ) {
        yield* this.setAccessAddresses(
          project,
          {
            workerAddresses:
              data.workerAddresses ?? project.workerAddresses ?? [],
            viewerAddresses:
              data.viewerAddresses ?? project.viewerAddresses ?? [],
          },
          {
            workerAddresses: project.workerAddresses ?? [],
            viewerAddresses: project.viewerAddresses ?? [],
          },
        )
      }

      yield* this.applyEdit(project, data)
    })
  }

  private applyEdit(project: Project, data: Project): RepoEffect<void> {
    delete (data as Partial<Project>).agents
    // Transformation exposes absent fields as undefined; a partial edit must
    // retain the stored policy so legacy nulls can be normalized on save.
    const editable: Partial<Project> = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    )
    delete editable.agentAttachments
    delete editable.workerAddresses
    delete editable.viewerAddresses
    delete editable.workers
    delete editable.viewers
    delete editable.user
    delete editable.invoices
    delete editable.time
    delete editable.statistics
    delete editable.id
    delete editable.createdAt
    delete editable.updatedAt

    delete editable.agentTrackingSince
    if (data.trackAgents && !project.trackAgents)
      project.agentTrackingSince = new Date()
    Object.assign(project, editable)

    return this.plan
      .aroundListChange(project.user?.id, this.save(project))
      .pipe(Effect.asVoid)
  }

  /**
   * Addresses need not belong to an existing user yet — a project owner can
   * grant access to a wallet before it has ever signed in. Access is granted
   * purely by address membership (see ProjectRepository's access filters),
   * so the not-yet-onboarded wallet gets access the moment it does sign in.
   */
  private setAccessAddresses(
    project: Project,
    data: ProjectAccessAddresses,
    current: ProjectAccessAddresses,
  ): RepoEffect<void> {
    return Effect.gen(this, function* () {
      const ownerAddress = AccountAddress.toCanonical(project.user.address)
      // Deduped on the canonical form, so one account entered twice is one entry,
      // while the surviving string keeps an EVM address's checksum casing.
      const forStorage = (addresses: string[]): string[] => {
        const seen = new Set<string>()

        return addresses
          .map((address) => {
            if (
              !AccountAddress.isEvm(address) &&
              !AccountAddress.isEmail(address)
            ) {
              throw new BadRequestError(
                'Each person must be an EVM address or an email',
              )
            }

            return AccountAddress.toStorage(address)
          })
          .filter((address) => {
            const key = AccountAddress.toCanonical(address)

            if (seen.has(key) || key === ownerAddress) {
              return false
            }

            seen.add(key)

            return true
          })
      }

      const workerAddresses = forStorage(data.workerAddresses)
      const viewerAddresses = forStorage(data.viewerAddresses)

      yield* fromPromise(() =>
        this.plan.checkGrant(project, workerAddresses, current.workerAddresses),
      )

      project.workerAddresses = workerAddresses
      project.viewerAddresses = viewerAddresses
    })
  }

  public save(project: Project) {
    // These two older columns allowed null, which has always meant recording off.
    if (project.trackProcesses === null) project.trackProcesses = false
    if (project.trackScreenshots === null) project.trackScreenshots = false
    for (const key of [
      'trackAgents',
      'trackProcesses',
      'trackScreenshots',
      'trackWindowTitles',
      'trackBrowserDomains',
      'allowManualTime',
    ] as const) {
      if (project[key] !== undefined && typeof project[key] !== 'boolean')
        throw new BadRequestError(`Invalid recording policy: ${key}`)
    }
    if (!project.trackProcesses) {
      project.trackWindowTitles = false
      project.trackBrowserDomains = false
    }
    if (
      project.reviewWindowHours !== undefined &&
      (!Number.isInteger(project.reviewWindowHours) ||
        project.reviewWindowHours < 1 ||
        project.reviewWindowHours > 24)
    )
      throw new BadRequestError('Review window must be from 1 to 24 hours')
    if (
      project.screenshotRetentionDays != null &&
      (!Number.isInteger(project.screenshotRetentionDays) ||
        project.screenshotRetentionDays < 1 ||
        project.screenshotRetentionDays > 3650)
    )
      throw new BadRequestError('Invalid screenshot retention')

    delete (project as Partial<Project>).agentAttachments
    delete project.agents
    return this.projectRepository.saveSingle(project)
  }

  // @deprecated remove demo data
}
