export type HourAxis = { max: number; ticks: number[] }

const TICK_COUNT = 6

// Integer hour ticks on the axis; fractional labels like "2.5H" clash with the
// tooltip format. Steps snap to 1/2/3/4/5 per decade so the axis reads
// 0-20-40-…-100, not 0-19-38-…-95.
export const getHourAxis = (maxHours: number): HourAxis => {
  const rawStep = Math.max(1, maxHours / (TICK_COUNT - 1))
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step =
    [1, 2, 3, 4, 5, 10]
      .map((unit) => unit * magnitude)
      .find((candidate) => candidate >= rawStep) ?? Math.ceil(rawStep)

  return {
    max: step * (TICK_COUNT - 1),
    ticks: Array.from({ length: TICK_COUNT }, (_, index) => index * step),
  }
}

// Charts that draw their own grid must use the same row count to line up.
export const HOUR_AXIS_TICK_COUNT = TICK_COUNT
