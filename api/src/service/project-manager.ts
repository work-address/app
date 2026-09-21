import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import moment from 'moment'
import { BadRequestError } from 'routing-controllers'

import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import {
  EProjectState,
  IInvoiceCadenceVersion,
  IInvoiceCadenceView,
} from '@/model/project'
import { User } from '@/entity/user'
import { ProjectAccessAddresses, ProjectCadenceDto } from '@/model/dto/project'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { InvoiceCadence } from '@/service/invoice-cadence'
import { WalletAddress } from '@/service/wallet-address'
import AccessException from '@/exception/access-exception'

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

  /**
   * The cadence as one reader sees it: the rule in force, its history, when
   * the next cutoff falls, and that reader's own consent.
   *
   * Worker-or-owner, like invoicing itself: the cutoff is when *your* hours
   * stop being this week's, so everyone whose hours it governs can see it. A
   * viewer is not on that list - they watch progress, not money (SPEC.md,
   * "Who can see what").
   */
  public readCadence(
    project: Project,
    user: User,
    now: Date = new Date(),
  ): RepoEffect<IInvoiceCadenceView> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertWorker(project, user)

      return ProjectManager.cadenceView(accessible, user, now)
    })
  }

  /**
   * Adds a version to the project's cadence. Owner only.
   *
   * Appended rather than written over: an invoice the schedule has already
   * issued was issued under the rule that was in force then, and an owner who
   * moves the cutoff is stating a new rule from now on, not rewriting what
   * last month billed. That is why the stored value is an array and why the
   * new version carries an `effectiveFrom`.
   */
  public setCadence(
    project: Project,
    user: User,
    data: ProjectCadenceDto,
    now: Date = new Date(),
  ): RepoEffect<IInvoiceCadenceView> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertOwner(project, user)

      const version: IInvoiceCadenceVersion = {
        weekday: data.weekday,
        timezone: data.timezone,
        cutoffLocal: data.cutoffLocal,
        effectiveFrom: moment
          .utc(data.effectiveFromUnix ?? now.getTime())
          .toISOString(),
        finalizationDelayHours:
          data.finalizationDelayHours ??
          InvoiceCadence.DEFAULT_FINALIZATION_DELAY_HOURS,
      }
      const problems = InvoiceCadence.problems(version)

      if (problems.length) {
        return yield* Effect.fail(new BadRequestError(problems.join('; ')))
      }

      accessible.invoiceCadence = InvoiceCadence.append(
        accessible.invoiceCadence,
        version,
      )

      const saved = yield* this.save(accessible)

      return ProjectManager.cadenceView(saved, user, now)
    })
  }

  /**
   * Records one worker's answer to automatic issuance, their own and nobody
   * else's.
   *
   * The owner cannot answer on a worker's behalf - it is consent to issuing a
   * financial document in that person's name - and the owner answers for
   * themselves like everyone else, because they track and bill their own
   * hours too.
   */
  public setCadenceConsent(
    project: Project,
    user: User,
    consented: boolean,
    now: Date = new Date(),
  ): RepoEffect<IInvoiceCadenceView> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertWorker(project, user)

      accessible.invoiceCadenceConsent = InvoiceCadence.withConsent(
        accessible.invoiceCadenceConsent,
        user,
        consented,
        now,
      )

      const saved = yield* this.save(accessible)

      return ProjectManager.cadenceView(saved, user, now)
    })
  }

  /** What `user` is shown about `project`'s cadence at `now`. */
  public static cadenceView(
    project: Project,
    user: User,
    now: Date,
  ): IInvoiceCadenceView {
    const versions = InvoiceCadence.ordered(project.invoiceCadence)
    const current = InvoiceCadence.versionAt(versions, now)
    const nextCutoff = current
      ? InvoiceCadence.nextCutoffAfter(current, now)
      : null
    const consent = InvoiceCadence.consentOf(
      project.invoiceCadenceConsent,
      user,
    )

    return {
      current,
      versions,
      nextCutoff: nextCutoff ? nextCutoff.toISOString() : null,
      nextIssueAt:
        current && nextCutoff
          ? InvoiceCadence.issueAt(current, nextCutoff).toISOString()
          : null,
      consented: consent ? consent.consented : null,
      canEdit: project.isOwner(user),
    }
  }

  /** The project as the caller may see it, when they work on it or own it. */
  private assertWorker(project: Project, user: User): RepoEffect<Project> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.projectRepository.findProjectWithAccess(
        project,
        user,
      )

      if (!accessible || !accessible.isWorker(user)) {
        return yield* Effect.fail(
          new AccessException(
            'Only a worker or the owner of a project can see how it invoices',
          ),
        )
      }

      return accessible
    })
  }

  /** The project as its owner, who alone sets the rule money is billed by. */
  private assertOwner(project: Project, user: User): RepoEffect<Project> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.projectRepository.findProjectWithAccess(
        project,
        user,
      )

      if (!accessible || !accessible.isOwner(user)) {
        return yield* Effect.fail(
          new AccessException(
            'Only the owner of a project can change how it invoices',
          ),
        )
      }

      return accessible
    })
  }

  public save(project: Project) {
    return this.projectRepository.saveSingle(project)
  }

  // @deprecated remove demo data
}
