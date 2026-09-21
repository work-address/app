import {
  Body,
  HttpCode,
  HttpError,
  JsonController,
  Post,
  Req,
} from 'routing-controllers'
import express from 'express'
import { Effect } from 'effect'

import { App } from '@/app/app'
import { Project } from '@/entity/project'
import { MarketplaceEndDto } from '@/model/dto/marketplace-end'
import { MarketplaceHireDto } from '@/model/dto/marketplace-hire'
import { MarketplaceMilestoneInvoiceDto } from '@/model/dto/marketplace-milestone'
import { IInvoiceMilestoneResult } from '@/model/invoice'
import { MarketplacePauseDto } from '@/model/dto/marketplace-pause'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectManager } from '@/service/project-manager'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'
import AuthenticationException from '@/exception/authentication-exception'
import { getDataSource } from '@/connector/data-source'
import { MarketplaceAmendDto } from '@/model/dto/marketplace-amend'
import { MarketplaceTerms } from '@/service/marketplace-terms'

export interface IMarketplaceHireResult {
  projectId: string | null
  created: boolean
}

export interface IMarketplaceEndResult {
  /** The project the contract opened; null when it never opened one. */
  projectId: string | null
  /** Whether this call is the one that closed it. */
  closed: boolean
}

export interface IMarketplaceAmendResult {
  projectId: string
  /** The terms version the project now knows about. */
  version: number
  /** Whether this call recorded it; false for a repeat of one already there. */
  applied: boolean
}

export interface IMarketplacePauseResult {
  /** The project the contract opened; null when it never opened one. */
  projectId: string | null
  /** Whether the project takes no new time now. */
  paused: boolean
  /** Whether this call is the one that changed it. */
  changed: boolean
}

/**
 * Service-to-service hire from the marketplace: an accepted offer becomes a
 * project owned by the client with the freelancer as a worker, so nobody
 * re-enters the job by hand.
 *
 * Authenticated like the entitlement push — HMAC with the same shared secret
 * over the route and the re-serialised body, a replay window and a one-time
 * nonce. Every route here shares that secret, so each signature names the
 * method, path and header it was made for (`InternalRoute`): a body signed
 * for one route is refused on every other. Repeat-safe: the
 * contract id is unique on the project, so a retry answers with the project
 * the first call created.
 */
@JsonController('/internal')
export class MarketplaceHireController {
  /** Its own header, so a hire and an entitlement push cannot be confused. */
  public static readonly SIGNATURE_HEADER = InternalRoute.HIRE.header

  /**
   * The end call's own header, for the same reason: a captured hire must not
   * be replayable as an end, nor the other way round.
   */
  public static readonly END_SIGNATURE_HEADER = InternalRoute.END.header

  /**
   * The milestone bill's own header, for the same reason again: a captured
   * hire must not be replayable as a bill.
   */
  public static readonly MILESTONE_SIGNATURE_HEADER =
    InternalRoute.MILESTONE_INVOICE.header

  /**
   * The amendment's own header: a captured hire or end must not be
   * replayable as a change of rate, nor the other way round.
   */
  public static readonly AMEND_SIGNATURE_HEADER = InternalRoute.AMEND.header

  /**
   * The pause's own header: an end closes a project for good and a pause
   * only until a resume, so a captured one must not stand in for the other.
   */
  public static readonly PAUSE_SIGNATURE_HEADER = InternalRoute.PAUSE.header

  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository
  protected userRepository: UserRepository
  protected projectManager: ProjectManager
  protected invoiceManager: InvoiceManager

  constructor() {
    this.signature = App.container.get('EntitlementSignature')
    this.projectRepository = App.container.get('ProjectRepository')
    this.userRepository = App.container.get('UserRepository')
    this.projectManager = App.container.get('ProjectManager')
    this.invoiceManager = App.container.get('InvoiceManager')
  }

  @HttpCode(200)
  @Post('/marketplace/hire')
  public async hire(
    @Body() data: MarketplaceHireDto,
    @Req() request: express.Request,
  ): Promise<IMarketplaceHireResult> {
    const signature =
      request.header(MarketplaceHireController.SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.HIRE,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace hire outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException('Marketplace hire nonce already used')
    }

    const existing = await this.findForContract(data.contractId)

    if (existing) {
      return { projectId: existing.id, created: false }
    }

    return runPromise(
      Effect.gen(this, function* () {
        const [client, freelancer] = yield* Effect.all([
          this.userRepository.findOneBy({ where: { id: data.clientId } }),
          this.userRepository.findOneBy({ where: { id: data.freelancerId } }),
        ])

        // The marketplace authenticates people with this instance's own tokens,
        // so a client it has never seen means the two are misconfigured —
        // pointed at different deployments — not that a retry will help.
        // Answering 200 with no project hid that as a quiet non-result.
        if (!client) {
          return yield* Effect.fail(
            new HttpError(
              409,
              'The client account is not known to this instance',
            ),
          )
        }

        const address = freelancer?.address ?? data.freelancerAddress ?? null
        const project = new Project()

        project.title = data.title
        project.text = data.text || data.title
        project.rateHour = data.rateHour
        project.state = EProjectState.ACTIVE
        project.user = client
        project.workerAddresses = address
          ? [WalletAddress.toCanonical(address)]
          : []
        project.viewerAddresses = []
        // The terms the freelancer accepted, not this service's defaults: the
        // offer disclosed what would be recorded and how many hours a week,
        // and the project is where that agreement takes effect. Absent flags
        // mean off - a hire that says nothing never turns monitoring on.
        project.trackScreenshots = data.trackScreenshots ?? false
        project.trackProcesses = data.trackProcesses ?? false
        project.weeklyLimit = data.weeklyLimit ?? null
        project.weeklyPeriodStartsAt = data.weekStartsAt
          ? new Date(data.weekStartsAt * 1000)
          : null
        project.marketplaceContractId = data.contractId

        const outcome = yield* this.projectRepository.saveSingle(project).pipe(
          Effect.map((saved) => ({ saved, created: true })),
          // Two retries racing: the unique contract id lets one insert win,
          // and the loser answers with the winner's project — as not created,
          // since it did not create it.
          Effect.catchAll((error) =>
            Effect.promise(() => this.findForContract(data.contractId)).pipe(
              Effect.flatMap((winner) =>
                winner
                  ? Effect.succeed({ saved: winner, created: false })
                  : Effect.fail(error),
              ),
            ),
          ),
        )

        return { projectId: outcome.saved.id, created: outcome.created }
      }),
    )
  }

  /**
   * The contract ended on the marketplace, so its project stops taking new
   * time. Closing it is all this does: `findProjectForTimeTracking` only
   * matches an ACTIVE project, so a `POST /time` row for it is refused on
   * its own while every other row in the batch still lands, and the
   * project's hours and invoices stay readable to everyone who could read
   * them before.
   *
   * Idempotent, and deliberately not a 404 for a contract with no project:
   * a hire that never opened one has nothing left to stop, and answering an
   * error would leave the marketplace retrying an end it can never complete.
   */
  @HttpCode(200)
  @Post('/marketplace/end')
  public async end(
    @Body() data: MarketplaceEndDto,
    @Req() request: express.Request,
  ): Promise<IMarketplaceEndResult> {
    const signature =
      request.header(MarketplaceHireController.END_SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(InternalRoute.END, JSON.stringify(data), signature)
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace end outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException('Marketplace end nonce already used')
    }

    const project = await this.findForContract(data.contractId)

    if (!project) {
      return { projectId: null, closed: false }
    }

    // Remembered even for a project a pause already closed, so a resume
    // that was owed before the end and arrives after it reopens nothing.
    const firstEnd = !project.marketplaceEndedAt

    if (firstEnd) {
      project.marketplaceEndedAt = new Date()
    }

    if (project.state !== EProjectState.ACTIVE) {
      if (firstEnd) {
        await runPromise(this.projectRepository.saveSingle(project))
      }

      return { projectId: project.id, closed: false }
    }

    await runPromise(this.projectManager.close(project))

    return { projectId: project.id, closed: true }
  }

  /**
   * A milestone both sides agreed was delivered: raise the FIXED invoice that
   * bills it, on the project the contract opened (MS-03).
   *
   * There is no Settlement and no Allocation entity here, and this call
   * creates neither: app has five domains, and what it writes is an
   * `Invoice` row and nothing else. Paying it is the escrow's business, as it
   * is for an hourly invoice - the worker submits a commitment and the
   * marketplace pushes the confirmed outcome back to
   * `/internal/marketplace/settlement`.
   *
   * Authenticated exactly like the hire and the end, under its own header.
   * Idempotent twice over: the nonce refuses a replayed call, and beneath
   * that `milestoneRef` refuses a second invoice for the same milestone, so a
   * push signed afresh after a timeout answers with the first invoice rather
   * than billing the sum again.
   *
   * A contract with no project here, or a freelancer this instance does not
   * know, is a 409 rather than a quiet non-result: the two services are
   * misconfigured, and no retry will help.
   */
  @HttpCode(200)
  @Post('/marketplace/milestone-invoice')
  public async milestoneInvoice(
    @Body() data: MarketplaceMilestoneInvoiceDto,
    @Req() request: express.Request,
  ): Promise<IInvoiceMilestoneResult> {
    const signature =
      request.header(MarketplaceHireController.MILESTONE_SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.MILESTONE_INVOICE,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace milestone outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException(
        'Marketplace milestone nonce already used',
      )
    }

    const project = await this.findForContract(data.contractId)

    if (!project) {
      throw new HttpError(
        409,
        `No project on this instance was opened for contract ${data.contractId}`,
      )
    }

    const freelancer = await runPromise(
      this.userRepository.findOneBy({ where: { id: data.freelancerId } }),
    )

    if (!freelancer) {
      throw new HttpError(
        409,
        'The freelancer account is not known to this instance',
      )
    }

    return runPromise(
      this.invoiceManager.billMilestone(project, freelancer, {
        milestoneRef: data.milestoneRef,
        amountCents: data.amountCents,
        description: data.description,
        workStart: data.workStart,
        workEnd: data.workEnd,
      }),
    )
  }

  /**
   * Both sides agreed a new version of the contract's terms and it has
   * taken effect: the same project takes the new rate, weekly cap and
   * monitoring from `effectiveFrom`.
   *
   * Nothing already recorded is rewritten. An invoice already issued keeps
   * the rate it froze (DEC-04), and hours worked before `effectiveFrom`
   * keep the rate agreed for them even when invoiced later, because the
   * project keeps every version in `marketplaceTerms` and invoicing reads
   * the one each hour was worked under. The rate, cap and flags on the
   * project are the newest version's: what the tracker applies from now.
   *
   * A repeat of a version already recorded is a 200 that changes nothing
   * (the marketplace retries after a lost answer); the same version with
   * other terms, or one that starts out of order, is a 409. A contract with
   * no project is a 404: the marketplace only sends an amendment once the
   * hire opened one, so that means the two sides disagree about the hire.
   */
  @HttpCode(200)
  @Post('/marketplace/amend')
  public async amend(
    @Body() data: MarketplaceAmendDto,
    @Req() request: express.Request,
  ): Promise<IMarketplaceAmendResult> {
    const signature =
      request.header(MarketplaceHireController.AMEND_SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.AMEND,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace amendment outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException(
        'Marketplace amendment nonce already used',
      )
    }

    // Under the project's row lock: two versions arriving at once would
    // otherwise each read the trail without the other and one would be lost.
    return getDataSource().transaction(async (manager) => {
      const repository = manager.getRepository(Project)
      const project = await repository.findOne({
        where: { marketplaceContractId: data.contractId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      })

      if (!project) {
        throw new HttpError(404, 'No project was opened for this contract')
      }

      const recorded = MarketplaceTerms.record(project, {
        version: data.version,
        effectiveFrom: new Date(data.effectiveFrom * 1000).toISOString(),
        rateHour: data.rateHour,
        weeklyLimit: data.weeklyLimit ?? null,
        trackScreenshots: data.trackScreenshots,
        trackProcesses: data.trackProcesses,
      })

      if ('conflict' in recorded) {
        throw new HttpError(409, recorded.conflict)
      }

      if (!recorded.changed) {
        return { projectId: project.id, version: data.version, applied: false }
      }

      project.marketplaceTerms = recorded.versions

      if (recorded.latest) {
        project.rateHour = data.rateHour
        project.weeklyLimit = data.weeklyLimit ?? null
        project.trackScreenshots = data.trackScreenshots
        project.trackProcesses = data.trackProcesses
      }

      await repository.save(project)

      return { projectId: project.id, version: data.version, applied: true }
    })
  }

  /**
   * The client paused the contract, or resumed it. Paused, the project
   * takes no new time exactly as it takes none once the contract ends -
   * `findProjectForTimeTracking` only matches an ACTIVE project, so a
   * `POST /time` row for it is refused on its own while every other row in
   * the batch still lands. Resumed, it takes time again. Nothing already
   * recorded is touched either way.
   *
   * Ordered by `sequence`: one this project has already passed is a 200
   * that changes nothing, so a retry cannot undo a later move. A resume of
   * a contract the marketplace has ended reopens nothing. Like the end, a
   * contract with no project is a 200 with nothing to change - answering an
   * error would leave the marketplace retrying for ever.
   */
  @HttpCode(200)
  @Post('/marketplace/pause')
  public async pause(
    @Body() data: MarketplacePauseDto,
    @Req() request: express.Request,
  ): Promise<IMarketplacePauseResult> {
    const signature =
      request.header(MarketplaceHireController.PAUSE_SIGNATURE_HEADER) ?? ''

    if (
      !this.signature.verify(
        InternalRoute.PAUSE,
        JSON.stringify(data),
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid marketplace signature')
    }

    if (!this.signature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Marketplace pause outside the replay window',
      )
    }

    if (!(await this.signature.consumeNonce(data.nonce))) {
      throw new AuthenticationException('Marketplace pause nonce already used')
    }

    // Under the project's row lock, so two moves arriving at once are
    // ordered by their sequence rather than by which write lands last.
    return getDataSource().transaction(async (manager) => {
      const repository = manager.getRepository(Project)
      const project = await repository.findOne({
        where: { marketplaceContractId: data.contractId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      })

      if (!project) {
        return { projectId: null, paused: data.paused, changed: false }
      }

      const paused = () => project.state !== EProjectState.ACTIVE

      if ((project.marketplacePauseSequence ?? 0) >= data.sequence) {
        return { projectId: project.id, paused: paused(), changed: false }
      }

      project.marketplacePauseSequence = data.sequence

      const target =
        data.paused || project.marketplaceEndedAt
          ? EProjectState.INACTIVE
          : EProjectState.ACTIVE
      const changed = project.state !== target

      project.state = target
      await repository.save(project)

      return { projectId: project.id, paused: paused(), changed }
    })
  }

  private findForContract(contractId: string): Promise<Project | null> {
    return this.projectRepository
      .getRepo()
      .findOne({ where: { marketplaceContractId: contractId } })
  }
}
