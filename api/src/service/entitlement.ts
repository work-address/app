import { injectable, inject } from 'inversify'

import { IConfigParameters } from '@/model/config'
import { User } from '@/entity/user'

/**
 * Who is entitled to premium features, and — just as importantly — whether
 * this instance is one where that question has an answer.
 *
 * A self-hosted instance has no billing service to push entitlement to it, so
 * `user.premium` is never set on anything and would gate every account out of
 * collaborators and history. Absence of billing therefore reads as *entitled*,
 * not as a free tier: the open-source build is unrestricted by design.
 *
 * SaaS mode is detected from the entitlement secret rather than a dedicated
 * flag, so the two cannot disagree - an instance that can receive a push is
 * exactly the instance whose pushes should be believed.
 */
@injectable()
export class Entitlement {
  @inject('parameters')
  protected parameters: IConfigParameters

  /** True when a billing service is configured to push entitlement here. */
  public isSaaS(): boolean {
    return this.parameters.entitlementSecret.length > 0
  }

  public isPremium(user: Pick<User, 'premium'> | null | undefined): boolean {
    if (!this.isSaaS()) {
      return true
    }

    return Boolean(user?.premium)
  }

  /**
   * Whether a `premium = true` predicate should be applied to a query at all.
   * Query builders cannot call `isPremium` per row, so self-hosted instances
   * omit the clause instead of relying on column data - entitlement is
   * deployment configuration, not a fact about a user row, and writing it into
   * the table would strand any instance later pointed at the SaaS.
   */
  public shouldFilterByPremium(): boolean {
    return this.isSaaS()
  }
}
