/**
 * Screenshots drawn in the browser, so the demo needs no image host and works
 * offline. The API sends a screenshot as bare base64; these are the same.
 */
const PALETTES = [
  ['#2a78d6', '#184f95'],
  ['#eb6834', '#b4461e'],
  ['#1baf7a', '#106e50'],
  ['#6250d6', '#3c2896'],
  ['#e87ba4', '#a8466c'],
  ['#334155', '#0f172a'],
] as const

// One transparent pixel, for environments with no canvas (tests).
const FALLBACK =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let cache: string[] | null = null

const draw = ([from, to]: readonly [string, string], index: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 300
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return FALLBACK
  }
  const gradient = ctx.createLinearGradient(0, 0, 480, 300)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 480, 300)
  // A window with a title bar, a sidebar and lines of "text".
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillRect(28, 28, 424, 244)
  ctx.fillStyle = 'rgba(15,23,42,0.08)'
  ctx.fillRect(28, 28, 424, 22)
  ctx.fillRect(28, 50, 96, 222)
  ctx.fillStyle = from
  for (let line = 0; line < 8; line++) {
    const width = 120 + ((index * 37 + line * 53) % 180)
    ctx.globalAlpha = line === 0 ? 0.9 : 0.35
    ctx.fillRect(140, 66 + line * 24, width, 10)
  }
  ctx.globalAlpha = 1
  return canvas.toDataURL('image/png').split(',')[1] ?? FALLBACK
}

/** The demo's screenshots as base64, drawn once. */
export function demoScreenshots(): string[] {
  if (!cache) {
    cache =
      typeof document === 'undefined'
        ? PALETTES.map(() => FALLBACK)
        : PALETTES.map((palette, index) => draw(palette, index))
  }
  return cache
}

export const DEMO_SCREENSHOT_COUNT = PALETTES.length
