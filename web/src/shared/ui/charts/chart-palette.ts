/**
 * Series colours for identity - one per project or product, in a fixed
 * order - from the workspace chart tokens, so every chart shares the
 * dashboard's blues. Several are close in lightness, so every chart that uses
 * them names its series in a legend and a tooltip, never by colour alone.
 */
export const SERIES_COLORS = [
  'var(--ui-chart-1)',
  'var(--ui-chart-2)',
  'var(--ui-chart-3)',
  'var(--ui-chart-4)',
  'var(--ui-chart-5)',
  'var(--ui-chart-6)',
  'var(--ui-chart-7)',
  'var(--ui-chart-8)',
] as const

/** The tail past the last slot: never a ninth generated hue. */
export const OTHER_SERIES_COLOR = 'var(--ui-chart-other)'

/**
 * One hue, light to dark, for magnitude. The first step is "a little", not
 * "nothing": empty cells use the neutral track instead.
 */
export const SEQUENTIAL_BLUE = [
  'var(--ui-chart-7)',
  'var(--ui-chart-3)',
  'var(--ui-chart-5)',
  'var(--ui-chart-2)',
  'var(--ui-chart-6)',
  'var(--ui-chart-4)',
] as const

export const EMPTY_CELL_COLOR = 'var(--ui-inset)'

/**
 * Colour for an entity by its place in a stable list - the order the entities
 * were created in, not their rank in the chart - so filtering or a new period
 * never repaints a project.
 */
export const seriesColor = (index: number) =>
  index >= 0 && index < SERIES_COLORS.length
    ? SERIES_COLORS[index]
    : OTHER_SERIES_COLOR

/** A step of the sequential ramp for a share of the maximum, 0-1. */
export const sequentialColor = (share: number) => {
  if (share <= 0) {
    return EMPTY_CELL_COLOR
  }

  const step = Math.min(
    SEQUENTIAL_BLUE.length - 1,
    Math.floor(share * SEQUENTIAL_BLUE.length),
  )

  return SEQUENTIAL_BLUE[step]
}
