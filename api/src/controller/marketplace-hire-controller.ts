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
import { MarketplaceHireDto } from '@/model/dto/marketplace-hire'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'
import AuthenticationException from '@/exception/authentication-exception'

export interface IMarketplaceHireResult {
  projectId: string | null
  created: boolean
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
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository
  protected userRepository: UserRepository

  constructor() {
    this.signature = App.container.get('EntitlementSignature')
    this.projectRepository = App.container.get('ProjectRepository')
    this.userRepository = App.container.get('UserRepository')
  }

  @HttpCode(200)
  @Post('/marketplace/hire')
  public async hire(
    @Body() data: MarketplaceHireDto,
    @Req() request: express.Request,
  ): Promise<IMarketplaceHireResult> {
    const signature = request.header('X-Marketplace-Signature') ?? ''

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
        project.trackScreenshots = false
        project.trackProcesses = false
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

  private findForContract(contractId: string): Promise<Project | null> {
    return this.projectRepository
      .getRepo()
      .findOne({ where: { marketplaceContractId: contractId } })
  }
}
