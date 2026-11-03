export class Calc {
  /**
   * The interval the desktop tracker samples on: one Time row stands for one
   * window of wall-clock time that wide.
   *
   * Totalling real entries must not multiply by this. Rows carry their own
   * `fromAt`/`toAt` span, and rows written before the interval last moved
   * still span the old one - see {@link spanMinutes}. The constant is for
   * generated entries, which have to pick a width for themselves.
   */
  public static readonly trackerIntervalMinutes = 10

  /**
   * Wall-clock minutes a set of entries covers, taken from each row's own
   * span so that entries recorded under different tracker intervals total
   * correctly together. A backwards entry counts as nothing.
   */
  public static spanMinutes(times: { fromAt: Date; toAt: Date }[]): number {
    return times.reduce(
      (total, time) =>
        total +
        Math.max(
          0,
          (new Date(time.toAt).getTime() - new Date(time.fromAt).getTime()) /
            60000,
        ),
      0,
    )
  }
}
