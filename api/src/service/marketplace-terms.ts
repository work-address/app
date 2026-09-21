import { IMarketplaceTermsVersion } from '@/model/project'

// Type-only: `Project` reads this class's bound in a column decorator, and a
// value import of an entity here would close that cycle at runtime.
import type { Project } from '@/entity/project'
import type { Time } from '@/entity/time'

/** What recording one version did to a project's trail. */
export type TMarketplaceTermsRecord =
  | {
      /** The trail with the version in it, oldest first. */
      versions: IMarketplaceTermsVersion[]
      /** False when the same version was already there: a repeat. */
      changed: boolean
      /** Whether it is now the newest version, which the project runs on. */
      latest: boolean
    }
  | { conflict: string }

/** The hours one invoice may bill, and the rate they are billed at. */
export interface IMarketplaceTermsBillable {
  times: Time[]
  rateHour: number
  /** Where the next version starts; the hours from then on wait. Null when none does. */
  until: Date | null
}

/**
 * The arithmetic of a marketplace project's agreed terms over time: which
 * version governs an hour of work, and which hours one invoice may carry.
 *
 * An amendment agreed on the marketplace changes the rate from a date, not
 * retroactively. The project keeps every version it was told about, so an
 * hour worked under the old rate is billed at the old rate even when it is
 * invoiced after the new one took effect - and one invoice never mixes two
 * rates, because its snapshot has one rate and its amount is computed from
 * it (DEC-04). Hours under a later version move to the next invoice, the
 * way late time already does.
 *
 * Statics rather than an injected service, like `InvoiceCadence`: this is
 * arithmetic over its arguments with nothing to reach for.
 */
export class MarketplaceTerms {
  /**
   * How many versions a project keeps. The trail is financial history, so
   * it is bounded like every other list on Project.
   */
  public static readonly MAX_VERSIONS = 100

  /**
   * The trail with `next` in it, or why it cannot go in.
   *
   * The first version recorded also records the terms the project was
   * hired on, as they stand on the project now, with no start: without it
   * the hours worked before the change would have no rate of their own.
   *
   * A version already there is a repeat when it says the same thing (the
   * marketplace retried after a lost answer) and a conflict when it does
   * not. A version out of order is placed where it belongs, as long as its
   * start falls between its neighbours' - two versions that disagree about
   * which came first cannot both be true.
   */
  public static record(
    project: Project,
    next: IMarketplaceTermsVersion,
  ): TMarketplaceTermsRecord {
    const trail = project.marketplaceTerms?.length
      ? [...project.marketplaceTerms]
      : [MarketplaceTerms.asHired(project)]
    const same = trail.find((version) => version.version === next.version)

    if (same) {
      return MarketplaceTerms.sameVersion(same, next)
        ? { versions: trail, changed: false, latest: false }
        : { conflict: `Version ${next.version} was recorded with other terms` }
    }

    const versions = [...trail, next].sort((a, b) => a.version - b.version)
    const at = versions.indexOf(next)
    const starts = versions.map((version) =>
      version.effectiveFrom ? Date.parse(version.effectiveFrom) : -Infinity,
    )

    if (
      (at > 0 && starts[at] < starts[at - 1]) ||
      (at < versions.length - 1 && starts[at] > starts[at + 1])
    ) {
      return {
        conflict: `Version ${next.version} starts out of order with the versions around it`,
      }
    }

    if (versions.length > MarketplaceTerms.MAX_VERSIONS) {
      return {
        conflict: `A project keeps at most ${MarketplaceTerms.MAX_VERSIONS} versions of its terms`,
      }
    }

    return { versions, changed: true, latest: at === versions.length - 1 }
  }

  /**
   * The version governing an instant: the newest whose start is at or
   * before it. Null on a project that never had a version recorded.
   */
  public static at(
    project: Project,
    instant: Date,
  ): IMarketplaceTermsVersion | null {
    const trail = project.marketplaceTerms ?? []
    let governing: IMarketplaceTermsVersion | null = null

    for (const version of trail) {
      if (
        version.effectiveFrom === null ||
        Date.parse(version.effectiveFrom) <= instant.getTime()
      ) {
        governing = version
      }
    }

    return governing ?? trail[0] ?? null
  }

  /**
   * The hours of `times` one invoice may bill, and their rate: the ones
   * worked under the version governing the earliest of them, which is the
   * rate they were agreed at. The rest wait for the next invoice.
   *
   * A project with no versions bills every hour at its rate as it stands,
   * which is what it always did.
   */
  public static billable(
    project: Project,
    times: Time[],
  ): IMarketplaceTermsBillable {
    const trail = project.marketplaceTerms ?? []

    if (trail.length === 0 || times.length === 0) {
      return { times, rateHour: Number(project.rateHour) || 0, until: null }
    }

    const earliest = Math.min(
      ...times.map((time) => new Date(time.fromAt).getTime()),
    )
    const governing = MarketplaceTerms.at(project, new Date(earliest))
    const after = trail.find(
      (version) =>
        version.effectiveFrom !== null &&
        Date.parse(version.effectiveFrom) > earliest,
    )
    const until = after?.effectiveFrom ? new Date(after.effectiveFrom) : null

    return {
      times: until
        ? times.filter((time) => new Date(time.fromAt) < until)
        : times,
      rateHour: Number(governing?.rateHour ?? project.rateHour) || 0,
      until,
    }
  }

  /**
   * The terms a project was hired on, as the first entry of its trail: a
   * hire always carries version 1 of a contract's terms.
   */
  private static asHired(project: Project): IMarketplaceTermsVersion {
    return {
      version: 1,
      effectiveFrom: null,
      rateHour: Number(project.rateHour) || 0,
      weeklyLimit: project.weeklyLimit ?? null,
      trackScreenshots: project.trackScreenshots ?? false,
      trackProcesses: project.trackProcesses ?? false,
    }
  }

  private static sameVersion(
    a: IMarketplaceTermsVersion,
    b: IMarketplaceTermsVersion,
  ): boolean {
    const startOf = (version: IMarketplaceTermsVersion) =>
      version.effectiveFrom ? Date.parse(version.effectiveFrom) : null

    return (
      startOf(a) === startOf(b) &&
      Number(a.rateHour) === Number(b.rateHour) &&
      (a.weeklyLimit ?? null) === (b.weeklyLimit ?? null) &&
      a.trackScreenshots === b.trackScreenshots &&
      a.trackProcesses === b.trackProcesses
    )
  }
}
