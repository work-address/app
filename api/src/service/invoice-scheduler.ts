import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { ILogger } from '@/model/logging'
import { IInvoiceCadencePeriod } from '@/model/project'
import { IInvoiceIssueOutcome, InvoiceManager } from '@/service/invoice-manager'
import { InvoiceCadence } from '@/service/invoice-cadence'
import { ProjectRepository } from '@/repository/project-repository'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { UserRepository } from '@/repository/user-repository'

/** What one run did, for the log and for the tests. */
export interface IInvoiceSchedulerReport {
  projects: number
  periods: number
  issuers: number
  /** Invoices this run created. A rerun of the same periods creates none. */
  issued: number
  /** Periods an earlier run had already billed for that issuer. */
  alreadyIssued: number
  /** Periods that had nothing to bill for an issuer. */
  empty: number
}

/**
 * Issues each project's invoices on the cadence its owner stated.
 *
 * The schedule is a promise about *periods*, not about runs: for every period
 * that has closed and finished finalizing, every issuer who consented gets
 * exactly one invoice. So a run that was missed for three weeks issues three
 * invoices, one per week, rather than one covering the lot - each invoice
 * still says which week it bills - and running twice in a minute issues
 * nothing the second time. Nothing here remembers when it last ran; the
 * periods are computed from the cadence and the clock, and the unique key on
 * Invoice is what makes a repeat a no-op. That is deliberate: a scheduler
 * whose correctness depends on its own bookkeeping surviving a restart is a
 * scheduler that double-bills after a restart.
 *
 * Nobody is issued for without consent, and consent is per worker per project
 * (WP-96). The manual route is untouched and always available - a manual
 * invoice takes its entries out of the schedule's reach simply by billing
 * them, since only uninvoiced time is ever swept up.
 */
@injectable()
export class InvoiceScheduler {
  /**
   * How often the timer fires. Well under the shortest sensible finalization
   * delay, so a period is issued within the hour of becoming due; the work
   * itself is idempotent, so the exact interval is not load-bearing.
   */
  public static readonly INTERVAL_MS = 15 * 60 * 1000

  @inject('InvoiceManager')
  protected invoiceManager: InvoiceManager
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('ILogger')
  protected logger: ILogger

  private timer: NodeJS.Timeout | null = null

  /** Whether the periodic timer is armed. */
  public get running(): boolean {
    return this.timer !== null
  }

  /**
   * Arms the periodic run.
   *
   * `unref` so the timer never holds the process open on its own - a server
   * shutting down should not wait a quarter of an hour for it - and a second
   * call is a no-op rather than a second timer.
   */
  public start(intervalMs: number = InvoiceScheduler.INTERVAL_MS): void {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      void this.runAndLog()
    }, intervalMs)

    this.timer.unref?.()
  }

  public stop(): void {
    if (!this.timer) {
      return
    }

    clearInterval(this.timer)
    this.timer = null
  }

  /**
   * One pass over every project with a cadence.
   *
   * A project whose run fails is logged and skipped rather than taking the
   * rest of the pass with it: one bad project must not stop everybody else's
   * invoices from being raised.
   */
  public run(now: Date = new Date()): RepoEffect<IInvoiceSchedulerReport> {
    return Effect.gen(this, function* () {
      const projects = yield* this.projectRepository.findWithInvoiceCadence()
      const report: IInvoiceSchedulerReport = {
        projects: projects.length,
        periods: 0,
        issuers: 0,
        issued: 0,
        alreadyIssued: 0,
        empty: 0,
      }

      for (const project of projects) {
        const outcome = yield* this.runForProject(project, now).pipe(
          Effect.catchAll((error) => {
            this.logger.error(
              `InvoiceScheduler: project ${project.id} was skipped`,
              error,
            )

            return Effect.succeed(null)
          }),
        )

        if (!outcome) {
          continue
        }

        report.periods += outcome.periods
        report.issuers += outcome.issuers
        report.issued += outcome.issued
        report.alreadyIssued += outcome.alreadyIssued
        report.empty += outcome.empty
      }

      return report
    })
  }

  /**
   * One project's due periods, oldest first.
   *
   * The order is load-bearing: each period bills the issuer's uninvoiced
   * hours that ended by its close, so working forwards puts a late-synced
   * entry in the first period that closed after it arrived, and working
   * backwards would put every backlog hour in the newest period.
   */
  public runForProject(
    project: Project,
    now: Date = new Date(),
  ): RepoEffect<IInvoiceSchedulerReport> {
    return Effect.gen(this, function* () {
      const periods = InvoiceCadence.duePeriods(project.invoiceCadence, now)
      const issuers = yield* this.consentingWorkers(project)
      const report: IInvoiceSchedulerReport = {
        projects: 1,
        periods: periods.length,
        issuers: issuers.length,
        issued: 0,
        alreadyIssued: 0,
        empty: 0,
      }

      for (const period of periods) {
        for (const issuer of issuers) {
          const outcome = yield* this.issueOne(project, issuer, period)

          if (outcome.created) {
            report.issued += 1
          } else if (outcome.invoice) {
            report.alreadyIssued += 1
          } else {
            report.empty += 1
          }
        }
      }

      return report
    })
  }

  /**
   * Issues one period for one issuer, reporting the invoice only when this
   * call is what created it - a period already billed is not billed again,
   * and an empty one raises nothing.
   */
  private issueOne(
    project: Project,
    issuer: User,
    period: IInvoiceCadencePeriod,
  ): RepoEffect<IInvoiceIssueOutcome> {
    return this.invoiceManager.issueForPeriod(project, issuer, period).pipe(
      Effect.catchAll((error) => {
        this.logger.error(
          `InvoiceScheduler: ${issuer.id} on project ${project.id} for the period ending ${period.end} was skipped`,
          error,
        )

        return Effect.succeed({ invoice: null, created: false })
      }),
    )
  }

  /**
   * Everyone on this project who has said yes and is still a worker on it.
   *
   * Consent outlives the project membership that prompted it - it is a record
   * of an answer, not a role - so somebody taken off the project is filtered
   * out here rather than having their consent quietly deleted.
   */
  private consentingWorkers(project: Project): RepoEffect<User[]> {
    return Effect.gen(this, function* () {
      const ids = InvoiceCadence.consentingUserIds(
        project.invoiceCadenceConsent,
      )
      const workers: User[] = []

      for (const id of ids) {
        const user = yield* this.userRepository.findOneBy({ where: { id } })

        if (user && project.isWorker(user)) {
          workers.push(user)
        }
      }

      return workers
    })
  }

  /** The timer's callback: run, log, and never reject. */
  private async runAndLog(): Promise<void> {
    try {
      const report = await Effect.runPromise(this.run())

      if (report.issued > 0) {
        this.logger.info(
          `InvoiceScheduler: issued ${report.issued} invoice(s) over ${report.periods} due period(s)`,
        )
      }
    } catch (error: unknown) {
      this.logger.error('InvoiceScheduler: the run failed', error)
    }
  }
}
