import moment from 'moment-timezone'

import {
  IInvoiceCadenceConsent,
  IInvoiceCadencePeriod,
  IInvoiceCadenceVersion,
} from '@/model/project'
import { WalletAddress } from '@/service/wallet-address'

// Type-only: `Project` reads this class's bounds in a column decorator, and a
// value import of an entity here would close that cycle at runtime.
import type { User } from '@/entity/user'

/**
 * The arithmetic of a weekly invoicing cadence: when the next cutoff falls,
 * which periods are due, and which version of the rule governs each of them.
 *
 * Every answer here is a wall-clock answer in the cadence's own zone. A
 * cadence says "Monday at 09:00 in Europe/Berlin", and that is 09:00 as the
 * clock on the wall reads it in both halves of the year - so the interval
 * between two consecutive cutoffs is 168 hours only in a week with no
 * daylight-saving change in it, 167 across a spring forward and 169 across an
 * autumn back. Computing cutoffs by adding seven days' worth of milliseconds
 * would put the cutoff an hour out for half the year, which is why every step
 * below goes through moment-timezone's calendar arithmetic instead.
 *
 * Statics rather than an injected service: this is arithmetic over its
 * arguments, with no state and nothing to reach for, like `Calc` and
 * `InvoiceEscrow` beside it.
 */
export class InvoiceCadence {
  /** The owner decision (development-plan proposal): a full day. */
  public static readonly DEFAULT_FINALIZATION_DELAY_HOURS = 24

  /** A week of grace at most: past that, the period is simply late. */
  public static readonly MAX_FINALIZATION_DELAY_HOURS = 168

  /**
   * How many versions a project keeps. The array is the audit trail of a
   * financial rule, so it is bounded like every other list on Project - an
   * owner toggling the weekday in a loop must not grow a row without limit.
   */
  public static readonly MAX_VERSIONS = 100

  /**
   * How far back one scheduler run will catch up: eight weekly periods.
   *
   * A run that has been missed for two months should bill the last eight
   * weeks period by period, not raise one invoice covering the lot (that is
   * what makes catch-up "per period"). Older than that is not the scheduler's
   * business - nothing was billed automatically then, and the hours are still
   * there to be invoiced by hand.
   */
  public static readonly MAX_CATCHUP_PERIODS = 8

  private static readonly CUTOFF = /^([01]\d|2[0-3]):([0-5]\d)$/

  /**
   * Everything wrong with a proposed version, as plain sentences. Empty when
   * it is usable. Reported rather than thrown so a caller can answer with all
   * of them at once.
   */
  public static problems(version: IInvoiceCadenceVersion): string[] {
    const problems: string[] = []

    if (
      !Number.isInteger(version.weekday) ||
      version.weekday < 0 ||
      version.weekday > 6
    ) {
      problems.push('The weekday must be a whole number from 0 (Sunday) to 6')
    }

    if (!moment.tz.zone(version.timezone ?? '')) {
      problems.push(`${version.timezone} is not an IANA time zone`)
    }

    if (!InvoiceCadence.CUTOFF.test(version.cutoffLocal ?? '')) {
      problems.push('The cutoff must be a local time of day as HH:mm')
    }

    if (!moment.utc(version.effectiveFrom, moment.ISO_8601, true).isValid()) {
      problems.push('The effective date must be an ISO-8601 instant')
    }

    if (
      !Number.isInteger(version.finalizationDelayHours) ||
      version.finalizationDelayHours < 0 ||
      version.finalizationDelayHours >
        InvoiceCadence.MAX_FINALIZATION_DELAY_HOURS
    ) {
      problems.push(
        `The finalization delay must be a whole number of hours from 0 to ${InvoiceCadence.MAX_FINALIZATION_DELAY_HOURS}`,
      )
    }

    return problems
  }

  /** The version as it is stored: normalised, so two equal rules compare equal. */
  public static normalize(
    version: IInvoiceCadenceVersion,
  ): IInvoiceCadenceVersion {
    return {
      weekday: version.weekday,
      timezone: version.timezone,
      cutoffLocal: version.cutoffLocal,
      effectiveFrom: moment.utc(version.effectiveFrom).toISOString(),
      finalizationDelayHours: version.finalizationDelayHours,
    }
  }

  /**
   * The stored versions, oldest first.
   *
   * Reading sorts rather than trusting the column: the array is jsonb, and an
   * older row written before this ordering existed must still be read the
   * same way as a new one.
   */
  public static ordered(
    versions: IInvoiceCadenceVersion[] | null | undefined,
  ): IInvoiceCadenceVersion[] {
    return [...(versions ?? [])].sort(
      (left, right) =>
        Date.parse(left.effectiveFrom) - Date.parse(right.effectiveFrom),
    )
  }

  /**
   * The history with `next` added.
   *
   * A version replaces any existing one with the same `effectiveFrom` - an
   * owner correcting a rule before it starts is editing it, not stacking a
   * second one on the same instant - and the list is trimmed to the most
   * recent {@link MAX_VERSIONS}.
   */
  public static append(
    versions: IInvoiceCadenceVersion[] | null | undefined,
    next: IInvoiceCadenceVersion,
  ): IInvoiceCadenceVersion[] {
    const normalized = InvoiceCadence.normalize(next)
    const kept = InvoiceCadence.ordered(versions).filter(
      (version) =>
        moment.utc(version.effectiveFrom).toISOString() !==
        normalized.effectiveFrom,
    )

    return InvoiceCadence.ordered([...kept, normalized]).slice(
      -InvoiceCadence.MAX_VERSIONS,
    )
  }

  /**
   * The version governing `at`: the latest one that had already come into
   * effect. Null when the project has no cadence yet, or when every version
   * it has starts in the future.
   */
  public static versionAt(
    versions: IInvoiceCadenceVersion[] | null | undefined,
    at: Date,
  ): IInvoiceCadenceVersion | null {
    // A plain walk forward, keeping the last match: the array is ordered, and
    // `findLast`/`at` need a newer lib than this package targets.
    let latest: IInvoiceCadenceVersion | null = null

    for (const version of InvoiceCadence.ordered(versions)) {
      if (Date.parse(version.effectiveFrom) <= at.getTime()) {
        latest = version
      }
    }

    return latest
  }

  /**
   * The first cutoff strictly after `after`.
   *
   * Wall-clock arithmetic throughout: the day is stepped in calendar days and
   * the time of day is *set* on that day rather than added as a duration, so
   * a cutoff stays at the same reading of the local clock across a
   * daylight-saving change. On the one day a year when the named local time
   * does not exist (the hour a spring forward skips), moment-timezone moves
   * forward to the next instant that does, so the cutoff still happens.
   */
  public static nextCutoffAfter(
    version: IInvoiceCadenceVersion,
    after: Date,
  ): Date {
    const zoned = moment.tz(after, version.timezone)
    const delta = (version.weekday - zoned.day() + 7) % 7
    const candidate = InvoiceCadence.atCutoff(
      zoned.clone().add(delta, 'days'),
      version,
    )

    if (candidate.isAfter(zoned)) {
      return candidate.toDate()
    }

    return InvoiceCadence.atCutoff(
      candidate.clone().add(7, 'days'),
      version,
    ).toDate()
  }

  /** The last cutoff at or before `at`. */
  public static cutoffAtOrBefore(
    version: IInvoiceCadenceVersion,
    at: Date,
  ): Date {
    const zoned = moment.tz(at, version.timezone)
    const delta = (zoned.day() - version.weekday + 7) % 7
    const candidate = InvoiceCadence.atCutoff(
      zoned.clone().subtract(delta, 'days'),
      version,
    )

    if (!candidate.isAfter(zoned)) {
      return candidate.toDate()
    }

    return InvoiceCadence.atCutoff(
      candidate.clone().subtract(7, 'days'),
      version,
    ).toDate()
  }

  /**
   * Where the period closing at `cutoff` opened.
   *
   * Normally the previous cutoff of the rule that closed it. When that rule
   * came into force *inside* the period, the earlier cutoff it would have
   * produced never actually happened, so the period opened at the last cutoff
   * the rule then in force did produce: an owner who moves the cutoff from
   * Monday to Friday gets one transitional period from the last Monday to the
   * first Friday, not two overlapping ones.
   */
  public static periodStart(
    versions: IInvoiceCadenceVersion[],
    cutoff: Date,
  ): Date {
    const justBefore = new Date(cutoff.getTime() - 1)
    const closing = InvoiceCadence.versionAt(versions, justBefore)

    if (!closing) {
      return cutoff
    }

    const candidate = InvoiceCadence.cutoffAtOrBefore(closing, justBefore)
    const startedGoverning = Date.parse(closing.effectiveFrom)

    if (startedGoverning <= candidate.getTime()) {
      return candidate
    }

    const beforeTheChange = new Date(startedGoverning - 1)
    const opening = InvoiceCadence.versionAt(versions, beforeTheChange)

    return opening
      ? InvoiceCadence.cutoffAtOrBefore(opening, beforeTheChange)
      : candidate
  }

  /**
   * The periods whose invoices are due at `now` and have not been issued yet,
   * oldest first.
   *
   * One entry per period, never one entry covering several: a run missed for
   * three weeks produces three periods, so each invoice still says which week
   * it bills. The walk stops at the earliest version's `effectiveFrom` - a
   * cadence turned on today does not reach back over hours nobody agreed to
   * bill automatically - and at {@link MAX_CATCHUP_PERIODS} in any case.
   *
   * Each period is measured with the version that governed its *end*, which
   * is the rule that decided when it closed.
   */
  public static duePeriods(
    versions: IInvoiceCadenceVersion[] | null | undefined,
    now: Date,
    cap: number = InvoiceCadence.MAX_CATCHUP_PERIODS,
  ): IInvoiceCadencePeriod[] {
    const ordered = InvoiceCadence.ordered(versions)
    const governing = InvoiceCadence.versionAt(ordered, now)

    if (!governing || cap <= 0) {
      return []
    }

    const floor = Date.parse(ordered[0].effectiveFrom)
    const due: IInvoiceCadencePeriod[] = []

    let end = InvoiceCadence.cutoffAtOrBefore(governing, now)

    for (let step = 0; step < cap && end.getTime() > floor; step += 1) {
      // The rule that closed the period, which is the one in force an instant
      // before the cutoff itself.
      const version =
        InvoiceCadence.versionAt(ordered, new Date(end.getTime() - 1)) ??
        governing
      const issueAt = InvoiceCadence.issueAt(version, end)
      const start = InvoiceCadence.periodStart(ordered, end)

      if (issueAt.getTime() <= now.getTime()) {
        due.unshift({
          start: start.toISOString(),
          end: end.toISOString(),
          issueAt: issueAt.toISOString(),
        })
      }

      if (start.getTime() >= end.getTime()) {
        break
      }

      end = start
    }

    return due
  }

  /** When the invoice for a period closing at `cutoff` becomes due. */
  public static issueAt(version: IInvoiceCadenceVersion, cutoff: Date): Date {
    return moment
      .utc(cutoff)
      .add(version.finalizationDelayHours, 'hours')
      .toDate()
  }

  /** One worker's stored answer, or null when they have never given one. */
  public static consentOf(
    consents: IInvoiceCadenceConsent[] | null | undefined,
    user: User,
  ): IInvoiceCadenceConsent | null {
    return (
      (consents ?? []).find((consent) => consent.userId === user.id) ?? null
    )
  }

  /** The stored answers with this user's replaced by `consented`. */
  public static withConsent(
    consents: IInvoiceCadenceConsent[] | null | undefined,
    user: User,
    consented: boolean,
    decidedAt: Date,
  ): IInvoiceCadenceConsent[] {
    const others = (consents ?? []).filter(
      (consent) => consent.userId !== user.id,
    )

    return [
      ...others,
      {
        userId: user.id,
        address: WalletAddress.toCanonical(user.address),
        consented,
        decidedAt: decidedAt.toISOString(),
      },
    ]
  }

  /** The ids of everyone who has said yes on this project. */
  public static consentingUserIds(
    consents: IInvoiceCadenceConsent[] | null | undefined,
  ): string[] {
    return (consents ?? [])
      .filter((consent) => consent.consented)
      .map((consent) => consent.userId)
  }

  /**
   * `day` moved to the cadence's local time of day.
   *
   * `hours`/`minutes` set the wall clock, where `add(n, 'minutes')` would add
   * a duration - the difference is exactly one hour on each daylight-saving
   * day, and it is the reason a cutoff keeps its reading all year.
   */
  private static atCutoff(
    day: moment.Moment,
    version: IInvoiceCadenceVersion,
  ): moment.Moment {
    const [hours, minutes] = version.cutoffLocal.split(':').map(Number)

    return day.clone().hours(hours).minutes(minutes).seconds(0).milliseconds(0)
  }
}
