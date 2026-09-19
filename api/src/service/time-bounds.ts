import { ValidationError } from 'class-validator'

import { TimeCreateDto } from '@/model/dto/time'

/**
 * What the server accepts as one tracked slice (DEC-10's active-minute rule,
 * development-plan values while the owner decision is open).
 *
 * Invoices bill `minutesActive`, and marketplace work is paid from escrow on
 * those invoices, so the figure cannot be whatever a client sends. An older
 * desktop build, or a hand-made request, could claim sixty active minutes in
 * a ten-minute slice. The rules:
 *
 * - `fromAt` is before `toAt`, and the slice spans at most
 *   {@link maxSpanMinutes};
 * - `fromAt` is at most {@link maxFutureMinutes} past the server's clock -
 *   room for clock skew, not for a slice that has not started;
 * - `minutesActive` is between 0 and the minutes from `fromAt` to whichever
 *   comes first, `toAt` or {@link maxFutureMinutes} past the server's clock,
 *   rounded up;
 * - the activity counters are not negative.
 *
 * The future bound is on what the row claims, not on `toAt`. The desktop
 * tracker sends its ten-minute bucket with `toAt` at the bucket's planned
 * end, not when work stopped, and it uploads the bucket still in progress -
 * on Stop, at start-up and on a token refresh - then sends it again once it
 * is over. So `toAt` can be up to ten minutes ahead of the clock in a normal
 * upload, and a refusal there is final on the desktop: it marks the bucket's
 * rows as failed and never sends them again. What the in-progress bucket can
 * claim is the minutes that have passed, and that is what is bounded; the
 * span rule already keeps `toAt` within an hour of `fromAt`.
 *
 * A tracker whose clock is within {@link maxFutureMinutes} of the server's
 * breaks none of these rules.
 *
 * A value of the wrong type is not bounded here: the entity's own validation
 * reports it, as it always has, so a malformed row reads the same as before.
 */
export class TimeBounds {
  /** The longest one row may cover. The desktop tracker's slice is ten. */
  public static readonly maxSpanMinutes = 60
  /**
   * How far past the server's clock a slice may start, and its active
   * minutes may reach: clock skew between the tracker and the server.
   */
  public static readonly maxFutureMinutes = 5

  private static readonly counters = [
    'keyboardKeys',
    'mouseKeys',
    'mouseDistance',
  ] as const

  /**
   * Every rule the row breaks, as class-validator errors so the row's error
   * has the shape of any other validation failure. Empty when it breaks none.
   *
   * `slice` is the start and end exactly as they would be stored, so what is
   * checked is what would be written. `now` is the server's clock, read once
   * for the whole batch.
   */
  public static violations(
    item: TimeCreateDto,
    slice: { fromAt: Date; toAt: Date },
    now: Date,
  ): ValidationError[] {
    const found = new Map<string, ValidationError>()
    const add = (property: string, rule: string, message: string) => {
      const error = found.get(property) ?? TimeBounds.error(item, property)

      error.constraints = { ...error.constraints, [rule]: message }
      found.set(property, error)
    }

    const fromAt = TimeBounds.valid(slice.fromAt)
    const toAt = TimeBounds.valid(slice.toAt)
    const spanMinutes =
      fromAt && toAt ? (toAt.getTime() - fromAt.getTime()) / 60_000 : undefined

    if (spanMinutes !== undefined && spanMinutes <= 0) {
      add('toAt', 'isAfterFromAt', 'toAt must be later than fromAt')
    }
    if (spanMinutes !== undefined && spanMinutes > TimeBounds.maxSpanMinutes) {
      add(
        'toAt',
        'maxSpan',
        `toAt must be at most ${TimeBounds.maxSpanMinutes} minutes after fromAt`,
      )
    }
    // The latest instant a slice may claim work for: the server's clock plus
    // the skew allowance. The tracker's in-progress bucket ends after it, so
    // its active minutes are bounded by the time that has passed, not by
    // the bucket's planned end.
    const latest = now.getTime() + TimeBounds.maxFutureMinutes * 60_000
    const startsTooLate = fromAt !== undefined && fromAt.getTime() > latest

    if (startsTooLate) {
      add(
        'fromAt',
        'notInFuture',
        `fromAt must be at most ${TimeBounds.maxFutureMinutes} minutes ahead of the server's clock`,
      )
    }

    if (TimeBounds.isNumber(item.minutesActive)) {
      // From fromAt to toAt or the latest instant, whichever comes first.
      // Left undefined for a slice already refused on its dates: one that
      // ends before it starts, or starts past the skew allowance, has no
      // elapsed minutes to compare against.
      const elapsedMinutes =
        fromAt && toAt && toAt > fromAt && !startsTooLate
          ? (Math.min(toAt.getTime(), latest) - fromAt.getTime()) / 60_000
          : undefined

      if (item.minutesActive < 0) {
        add('minutesActive', 'min', 'minutesActive must not be less than 0')
      } else if (
        spanMinutes !== undefined &&
        spanMinutes > 0 &&
        item.minutesActive > Math.ceil(spanMinutes)
      ) {
        add(
          'minutesActive',
          'maxSpanMinutes',
          `minutesActive must not exceed the ${Math.ceil(spanMinutes)} minute(s) from fromAt to toAt`,
        )
      } else if (
        elapsedMinutes !== undefined &&
        item.minutesActive > Math.ceil(elapsedMinutes)
      ) {
        add(
          'minutesActive',
          'maxElapsedMinutes',
          `minutesActive must not exceed the ${Math.ceil(elapsedMinutes)} minute(s) from fromAt to ${TimeBounds.maxFutureMinutes} minutes past the server's clock`,
        )
      }
    }

    for (const counter of TimeBounds.counters) {
      const value = item[counter]

      if (TimeBounds.isNumber(value) && value < 0) {
        add(counter, 'min', `${counter} must not be less than 0`)
      }
    }

    return [...found.values()]
  }

  private static error(item: TimeCreateDto, property: string): ValidationError {
    const error = new ValidationError()

    error.property = property
    error.value = (item as unknown as Record<string, unknown>)[property]
    error.constraints = {}
    error.children = []

    return error
  }

  /** An unparseable date is left to the entity's `@IsDate`. */
  private static valid(date: Date): Date | undefined {
    return Number.isNaN(date.getTime()) ? undefined : date
  }

  private static isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }
}
