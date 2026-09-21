import { Project } from '@/entity/project'
import { ITimeWindow } from '@/model/time'

/** Milliseconds in one weekly period. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The weekly hour cap a project was agreed under, and which seven days each
 * period covers.
 *
 * A period runs from when the project's work began, not from a Monday: a
 * marketplace contract starting on a Thursday would otherwise get two full
 * caps in four days, and the cap is a term of that contract. The marketplace
 * sends the contract's own start with the hire (`weeklyPeriodStartsAt`), so
 * the week the cap is measured against here and the week the contract card
 * shows hours for are the same seven days.
 *
 * Flagged, not refused, by the owner's decision (development plan, WP-51):
 * the hours were worked, and a tracker that silently drops them would
 * destroy the only record of work someone actually did. The overage is
 * reported instead, to both sides, and they settle it between them.
 */
export class WeeklyCap {
  /** The cap in whole minutes, or null where the project has none. */
  public static minutes(project: Project): number | null {
    return project.weeklyLimit ? project.weeklyLimit * 60 : null
  }

  /**
   * When the project's first weekly period opens: the start the hire named,
   * or failing that the project's own creation - the only start a project
   * made here directly has.
   */
  public static startedAt(project: Project): Date {
    return project.weeklyPeriodStartsAt ?? project.createdAt ?? new Date(0)
  }

  /**
   * The weekly period holding `at`, as a half-open window.
   *
   * Work before the project's start belongs to the period that would have
   * held it - the arithmetic runs backwards as happily as forwards - so an
   * entry backdated past the start is still measured against one week's
   * worth of cap rather than against the whole of history.
   */
  public static periodAt(project: Project, at: Date): ITimeWindow {
    const startedAt = WeeklyCap.startedAt(project).getTime()
    const index = Math.floor((at.getTime() - startedAt) / WEEK_MS)

    return {
      fromAt: new Date(startedAt + index * WEEK_MS),
      toAt: new Date(startedAt + (index + 1) * WEEK_MS),
    }
  }

  /**
   * Minutes past the cap in a period that recorded `minutes`, or null where
   * the project has no cap - which is not the same as zero overage, and the
   * two must not read alike.
   */
  public static overage(project: Project, minutes: number): number | null {
    const cap = WeeklyCap.minutes(project)

    return cap === null ? null : Math.max(0, minutes - cap)
  }
}
