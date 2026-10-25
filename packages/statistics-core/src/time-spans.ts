/** A half-open interval in epoch milliseconds. */
export type Span = [number, number]

/**
 * Interval arithmetic for time that can overlap: agent segments, human
 * entries, runs of several agents. Every result is sorted and disjoint.
 */
export class TimeSpans {
  public static minutes(spans: Span[]): number {
    return this.ms(spans) / 60000
  }

  public static ms(spans: Span[]): number {
    return spans.reduce((sum, [start, end]) => sum + end - start, 0)
  }

  public static union(spans: Span[]): Span[] {
    const merged: Span[] = []
    for (const [start, end] of spans
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1]
      if (last && start <= last[1]) last[1] = Math.max(last[1], end)
      else merged.push([start, end])
    }
    return merged
  }

  public static intersect(a: Span[], b: Span[]): Span[] {
    const out: Span[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      const start = Math.max(a[i][0], b[j][0])
      const end = Math.min(a[i][1], b[j][1])
      if (start < end) out.push([start, end])
      if (a[i][1] < b[j][1]) i++
      else j++
    }
    return out
  }

  public static subtract(a: Span[], b: Span[]): Span[] {
    const out: Span[] = []
    for (const [start, end] of a) {
      let cursor = start
      for (const [s, e] of b) {
        if (e <= cursor || s >= end) continue
        if (s > cursor) out.push([cursor, s])
        cursor = e
        if (cursor >= end) break
      }
      if (cursor < end) out.push([cursor, end])
    }
    return out
  }
}
