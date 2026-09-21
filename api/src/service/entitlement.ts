import { injectable, inject } from 'inversify'

import { IConfigParameters } from '@/model/config'
import { User } from '@/entity/user'

/**
 * Who is entitled to premium features, and — just as importantly — whether
 * this instance is one where that question has an answer.
 *
 * Premium governs one thing: how long recorded time is kept (see
 * TimeManager). Collaborators are free and never consult this service.
 *
 * A self-hosted instance has no billing service to push entitlement to it, so
 * `user.premium` is never set on anything and would put every account on the
 * rotating free history. Absence of billing therefore reads as *entitled*,
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

  /**
   * On SaaS, the stored flag - until the validity the last push carried runs
   * out. `premiumValidUntil` is what stops a billing service that went quiet
   * from leaving an account premium forever; it is null only on accounts no
   * push has given a validity yet, which keep the flag as it was.
   */
  public isPremium(
    user: Pick<User, 'premium' | 'premiumValidUntil'> | null | undefined,
    now: Date = new Date(),
  ): boolean {
    if (!this.isSaaS()) {
      return true
    }

    if (!user?.premium) {
      return false
    }

    const validUntil = user.premiumValidUntil

    return !validUntil || new Date(validUntil).getTime() > now.getTime()
  }
}
