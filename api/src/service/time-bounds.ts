import { ValidationError } from 'class-validator'

import { TimeCreateDto } from '@/model/dto/time'

/**
 * What the server accepts as one tracked slice (DEC-10, adopted).
 *
 * Invoices bill `minutesActive`, and marketplace work is paid from escrow on
 * those invoices, so the figure cannot be whatever a client sends. An older
 * desktop build, or a hand-made request, could claim sixty active minutes in
 * a ten-minute slice. Each rule here is one a real tracker never breaks:
 *
 * - `fromAt` is before `toAt`, and the slice spans at most
 *   {@link maxSpanMinutes};
 * - `toAt` is at most {@link maxFutureMinutes} past the server's clock -
 *   room for clock skew, not for work not yet done;
 * - `minutesActive` is between 0 and the slice's length in minutes, rounded
 *   up;
 * - the activity counters are not negative.
 *
 * A value of the wrong type is not bounded here: the entity's own validation
 * reports it, as it always has, so a malformed row reads the same as before.
 */
export class TimeBounds {
  /** The longest one row may cover. The desktop tracker's slice is ten. */
  public static readonly maxSpanMinutes = 60
  /** How far past the server's clock a slice may end. */
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
    if (
      toAt &&
      toAt.getTime() > now.getTime() + TimeBounds.maxFutureMinutes * 60_000
    ) {
      add(
        'toAt',
        'notInFuture',
        `toAt must be at most ${TimeBounds.maxFutureMinutes} minutes ahead of the server's clock`,
      )
    }

    if (TimeBounds.isNumber(item.minutesActive)) {
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
