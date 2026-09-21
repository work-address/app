export enum EProjectState {
  INACTIVE = 'Inactive',
  ACTIVE = 'Active',
}

export enum EUserProjectRole {
  ROLE_PROJECT_OWNER = 'PROJECT_ROLE_OWNER',
  ROLE_PROJECT_ADMIN = 'PROJECT_ROLE_ADMIN',
  ROLE_PROJECT_VIEWER = 'PROJECT_ROLE_VIEWER',
}

/**
 * One version of a project's invoicing cadence.
 *
 * A cadence is versioned rather than overwritten: an invoice already issued
 * was issued under the rule that was in force then, and changing the rule
 * must not rewrite what the schedule did last month. `effectiveFrom` is when
 * this version starts governing; the version in force at an instant is the
 * latest one whose `effectiveFrom` is at or before it.
 *
 * The cutoff is a wall-clock time in `timezone`, never a UTC offset: a team
 * that bills "Monday at 09:00 in Berlin" means 09:00 as the clock on the wall
 * reads it, on both sides of a daylight-saving change. That is also why a
 * cadence week is not always 168 hours long.
 */
export interface IInvoiceCadenceVersion {
  /** 0 is Sunday and 6 is Saturday, as `moment().day()` numbers them. */
  weekday: number
  /** An IANA zone name, e.g. `Europe/Berlin`. */
  timezone: string
  /** The local wall-clock cutoff, `HH:mm` on a 24-hour clock. */
  cutoffLocal: string
  /** ISO-8601 UTC instant from which this version governs. */
  effectiveFrom: string
  /**
   * How long after a period's cutoff its invoice is issued.
   *
   * The window exists because a desktop tracker uploads in buckets and can be
   * offline for hours: issuing at the cutoff itself would bill a week whose
   * last day had not arrived yet. Time that syncs after the window has closed
   * is not lost - it is billed by the next period (see InvoiceScheduler).
   */
  finalizationDelayHours: number
}

/**
 * One worker's answer to "may this project invoice my hours for me?".
 *
 * Persisted per project and per person, because it is consent to issue a
 * financial document in their name. Nobody is enrolled by default: a project
 * that turns a cadence on issues nothing for anyone who has not said yes.
 * The owner is a worker here too - they track and bill their own hours like
 * anyone else.
 */
export interface IInvoiceCadenceConsent {
  userId: string
  /** The worker's wallet address, canonical, for a record a person can read. */
  address: string
  consented: boolean
  /** ISO-8601 UTC instant of the answer. */
  decidedAt: string
}

/** One cadence period, and when its invoice becomes due. */
export interface IInvoiceCadencePeriod {
  /** ISO-8601 UTC instant of the cutoff that opened the period. */
  start: string
  /** ISO-8601 UTC instant of the cutoff that closed it. */
  end: string
  /** ISO-8601 UTC instant at which the period's invoice may be issued. */
  issueAt: string
}

/**
 * What a project's cadence looks like to one reader: the rule in force, when
 * the next cutoff falls, and whether that reader has consented.
 */
export interface IInvoiceCadenceView {
  /** The version governing now, or null when the project has no cadence. */
  current: IInvoiceCadenceVersion | null
  /** Every version, oldest first - the history the owner edited. */
  versions: IInvoiceCadenceVersion[]
  /** ISO-8601 UTC instant of the next cutoff, or null without a cadence. */
  nextCutoff: string | null
  /** When the invoice for the period that cutoff closes becomes due. */
  nextIssueAt: string | null
  /** The reader's own consent; null when they have never answered. */
  consented: boolean | null
  /** Whether the reader may edit the cadence. */
  canEdit: boolean
}

/**
 * One agreed version of a marketplace contract's terms, as the marketplace
 * told this project about it.
 *
 * Versioned rather than overwritten, like the invoicing cadence and for the
 * same reason: hours worked under one version keep that version's rate
 * whenever they are invoiced. `effectiveFrom` is when the version starts
 * governing; the one in force at an instant is the latest whose
 * `effectiveFrom` is at or before it. The first entry, recorded when the
 * first amendment arrives, is the terms the project was hired on and has
 * no start (null): it governs everything before the next.
 */
export interface IMarketplaceTermsVersion {
  /** The marketplace contract's terms version. */
  version: number
  /** ISO-8601 UTC instant it applies from; null for the terms as hired. */
  effectiveFrom: string | null
  rateHour: number
  weeklyLimit: number | null
  trackScreenshots: boolean
  trackProcesses: boolean
}

export interface IProject {
  id?: string
  title: string
  text: string
  rateHour: number
  state: EProjectState
  trackScreenshots?: boolean | null
  trackProcesses?: boolean | null
  weeklyLimit?: number | null
  weeklyPeriodStartsAt?: Date | null
  workerAddresses?: string[]
  viewerAddresses?: string[]
  invoiceCadence?: IInvoiceCadenceVersion[] | null
  invoiceCadenceConsent?: IInvoiceCadenceConsent[] | null
}
