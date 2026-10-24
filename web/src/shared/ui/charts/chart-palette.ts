/**
 * Series colours for identity - one per project or product, in a fixed
 * order. Validated as a set (adjacent CVD ΔE ≥ 9, normal-vision ΔE ≥ 19 on
 * the light surface). Three sit under 3:1 contrast, so every chart that uses
 * them names its series in a legend and a tooltip, never by colour alone.
 */
export const SERIES_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const

/** The tail past the last slot: never a ninth generated hue. */
export const OTHER_SERIES_COLOR = '#a3a29c'

/**
 * One hue, light to dark, for magnitude. The first step is "a little", not
 * "nothing": empty cells use the neutral track instead.
 */
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
] as const

export const EMPTY_CELL_COLOR = 'var(--ds-neutral-alpha-3)'

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
