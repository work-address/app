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
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { ProjectManager } from '@/service/project-manager'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'
import AuthenticationException from '@/exception/authentication-exception'

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

/**
 * Service-to-service hire from the marketplace: an accepted offer becomes a
 * project owned by the client with the freelancer as a worker, so nobody
 * re-enters the job by hand.
 *
 * Authenticated like the entitlement push — HMAC with the same shared secret
 * over the re-serialised body, a replay window and a one-time nonce — under
 * its own header so the two calls cannot be confused. Repeat-safe: the
 * contract id is unique on the project, so a retry answers with the project
 * the first call created.
 */
@JsonController('/internal')
export class MarketplaceHireController {
  /** Its own header, so a hire and an entitlement push cannot be confused. */
  public static readonly SIGNATURE_HEADER = 'X-Marketplace-Signature'

  /**
   * The end call's own header, for the same reason: a captured hire must not
   * be replayable as an end, nor the other way round.
   */
  public static readonly END_SIGNATURE_HEADER = 'X-Marketplace-End-Signature'

  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository
  protected userRepository: UserRepository
  protected projectManager: ProjectManager

  constructor() {
    this.signature = App.container.get('EntitlementSignature')
    this.projectRepository = App.container.get('ProjectRepository')
    this.userRepository = App.container.get('UserRepository')
    this.projectManager = App.container.get('ProjectManager')
  }

  @HttpCode(200)
  @Post('/marketplace/hire')
  public async hire(
    @Body() data: MarketplaceHireDto,
    @Req() request: express.Request,
  ): Promise<IMarketplaceHireResult> {
    const signature =
      request.header(MarketplaceHireController.SIGNATURE_HEADER) ?? ''

    if (!this.signature.verify(JSON.stringify(data), signature)) {
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

    if (!this.signature.verify(JSON.stringify(data), signature)) {
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

    if (project.state !== EProjectState.ACTIVE) {
      return { projectId: project.id, closed: false }
    }

    await runPromise(this.projectManager.close(project))

    return { projectId: project.id, closed: true }
  }

  private findForContract(contractId: string): Promise<Project | null> {
    return this.projectRepository
      .getRepo()
      .findOne({ where: { marketplaceContractId: contractId } })
  }
}
