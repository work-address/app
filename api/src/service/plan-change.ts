import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { TimeRepository } from '@/repository/time-repository'
import { AgentRunRecord } from '@/service/agent-run-record'
import { fromPromise } from '@/service/effect-bridge'
import { UserManager } from '@/service/user-manager'

/**
 * What happens when billing says an owner's plan changed. It stands beside
 * `Plan`, not inside it, because it calls the modules that read `Plan`.
 */
@injectable()
export class PlanChange {
  @inject('TimeRepository')
  protected entries: TimeRepository
  @inject('AgentRunRecord')
  protected runs: AgentRunRecord
  @inject('UserManager')
  protected userManager: UserManager

  /**
   * Puts the owner on Premium or takes them off it. An upgrade first brings
   * back the entries and runs rotation hid, each by the module that hid them.
   *
   * Restoring comes before the flag, so a failed restore is retried: billing
   * re-asserts the same state and it still looks like an upgrade. Applying
   * the state the owner already has costs one write and changes nothing.
   */
  public apply(owner: User, premium: boolean): RepoEffect<void> {
    return Effect.gen(this, function* () {
      if (premium && !owner.premium) {
        yield* this.entries.restoreRotated(owner.id)
        yield* fromPromise(() => this.runs.restoreRotated(owner.id))
      }

      owner.premium = premium
      yield* this.userManager.saveSingle(owner)
    })
  }
}
