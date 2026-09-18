import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { ProjectAccessAddresses } from '@/model/dto/project'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { WalletAddress } from '@/service/wallet-address'

@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository

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
      this.setAccessAddresses(data, {
        workerAddresses: data.workerAddresses ?? [],
        viewerAddresses: data.viewerAddresses ?? [],
      })
    }

    return this.save(data)
  }

  public editAndSave(project: Project, data: Project): RepoEffect<void> {
    if (
      data.workerAddresses !== undefined ||
      data.viewerAddresses !== undefined
    ) {
      this.setAccessAddresses(project, {
        workerAddresses: data.workerAddresses ?? project.workerAddresses ?? [],
        viewerAddresses: data.viewerAddresses ?? project.viewerAddresses ?? [],
      })
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
   *
   * Granting is not gated on the owner's plan: collaborators are free, and
   * premium governs how long recorded time is kept, nothing else.
   */
  private setAccessAddresses(
    project: Project,
    data: ProjectAccessAddresses,
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

    project.workerAddresses = forStorage(data.workerAddresses)
    project.viewerAddresses = forStorage(data.viewerAddresses)
  }

  public save(project: Project) {
    return this.projectRepository.saveSingle(project)
  }

  // @deprecated remove demo data
}
