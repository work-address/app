import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'

import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import moment from 'moment'
import { Time } from '@/entity/time'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectAccessAddresses } from '@/model/dto/project'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { Entitlement } from '@/service/entitlement'
import { WalletAddress } from '@/service/wallet-address'

@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('Entitlement')
  protected entitlement: Entitlement

  public findProjectCheckAccess(
    project: Project,
    user: User,
  ): RepoEffect<Project | undefined> {
    return this.projectRepository.findProjectWithAccess(project, user)
  }

  public close(project: Project): RepoEffect<void> {
    project.state = EProjectState.INACTIVE

    return this.save(project).pipe(Effect.asVoid)
  }

  public createAndSave(data: Project): RepoEffect<Project> {
    if (
      data.workerAddresses !== undefined ||
      data.viewerAddresses !== undefined
    ) {
      // A brand new project grants from nothing, so every address in the
      // payload counts as a grant.
      this.setAccessAddresses(
        data,
        {
          workerAddresses: data.workerAddresses ?? [],
          viewerAddresses: data.viewerAddresses ?? [],
        },
        { workerAddresses: [], viewerAddresses: [] },
      )
    }

    return this.save(data)
  }

  public editAndSave(project: Project, data: Project): RepoEffect<void> {
    if (
      data.workerAddresses !== undefined ||
      data.viewerAddresses !== undefined
    ) {
      this.setAccessAddresses(
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

    const editable: Partial<Project> = { ...data }
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

    Object.assign(project, editable)

    return this.save(project).pipe(Effect.asVoid)
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
  ): void {
    // Canonicalised on the way in, so an address pasted straight out of a
    // wallet works. TON shows people the friendly form (`UQ…`) while access is
    // granted by comparing against the raw form stored on User.address - before
    // this, such an entry validated, saved, and then granted nothing at all.
    const ownerAddress = WalletAddress.toCanonical(project.user.address)
    // Stored as typed apart from TON, which collapses to raw. Deduped on the
    // canonical form so the same account entered twice in two spellings is one
    // entry, while the surviving string keeps an EVM address's checksum casing.
    const forStorage = (addresses: string[]): string[] => {
      const seen = new Set<string>()

      return addresses
        .map((address) => WalletAddress.toStorage(address))
        .filter((address) => {
          const key = WalletAddress.toCanonical(address)

          if (seen.has(key) || key === ownerAddress) {
            return false
          }

          seen.add(key)

          return true
        })
    }

    const workerAddresses = forStorage(data.workerAddresses)
    const viewerAddresses = forStorage(data.viewerAddresses)

    if (!this.entitlement.isPremium(project.user)) {
      // Gate *granting*, never revoking. An owner whose subscription lapsed
      // still has to be able to take access away one collaborator at a time -
      // otherwise their only way out is to wipe the whole list.
      const grantsAccess =
        ProjectManager.addsAddress(workerAddresses, current.workerAddresses) ||
        ProjectManager.addsAddress(viewerAddresses, current.viewerAddresses)

      if (grantsAccess) {
        throw new BadRequestError(
          'Collaborators (workers and viewers) require a premium subscription',
        )
      }
    }

    project.workerAddresses = workerAddresses
    project.viewerAddresses = viewerAddresses
  }

  private static addsAddress(next: string[], current: string[]): boolean {
    const existing = new Set(
      current.map((address) => WalletAddress.toCanonical(address)),
    )

    return next.some(
      (address) => !existing.has(WalletAddress.toCanonical(address)),
    )
  }

  public save(project: Project) {
    return this.projectRepository.saveSingle(project)
  }

  // @deprecated remove demo data
  public createDemoData(user: User): RepoEffect<void> {
    // Effect.suspend so the demo entities are built per run rather than when
    // the effect is described - otherwise a second run would re-save the very
    // same instances, updating the rows the first run inserted.
    return Effect.suspend(() => {
      const project = new Project()
      project.title = 'Your first project'
      project.text = 'Demo'
      project.rateHour = 0
      project.user = user
      project.state = EProjectState.ACTIVE

      const times: Time[] = []
      const fromAt = moment().startOf('day')
      const toAt = moment().startOf('day').add(10, 'minutes')

      for (let i = 1; i < 6; i++) {
        const time = new Time()
        time.project = project
        time.user = user
        time.note = `Demo entry ${i}`
        time.mouseKeys = 0
        time.mouseDistance = 0
        time.keyboardKeys = 0
        time.minutesActive = i
        time.fromAt = fromAt.toDate()
        time.toAt = toAt.toDate()

        times.push(time)

        fromAt.add(1 * 10, 'minutes')
        toAt.add(1 * 10, 'minutes')
      }

      return Effect.gen(this, function* () {
        yield* this.save(project)
        yield* this.timeRepository.saveMany(times)
      })
    })
  }
}
