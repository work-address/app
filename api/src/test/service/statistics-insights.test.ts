import { expect } from 'chai'
import { InsightEntry, StatisticsInsights } from '@/service/statistics-insights'
import { Span } from '@/service/time-spans'
import { AgentSegment } from '@/model/agent'

const MIN = 60000
// Monday, 19 October 2026, 09:00 UTC.
const nine = Date.UTC(2026, 9, 19, 9)

/** Back-to-back ten-minute slots starting `offset` minutes after nine. */
const slots = (offset: number, count: number): Span[] =>
  Array.from(
    { length: count },
    (_, i): Span => [
      nine + (offset + i * 10) * MIN,
      nine + (offset + i * 10 + 10) * MIN,
    ],
  )

const entry = (span: Span, active: number | null = 420): InsightEntry => ({
  fromAt: new Date(span[0]),
  toAt: new Date(span[1]),
  activeSeconds: active,
  keyboardKeys: active === null ? null : 100,
  mouseKeys: active === null ? null : 20,
})

const segment = (
  state: AgentSegment['state'],
  from: number,
  to: number,
): AgentSegment => ({
  state,
  fromAt: new Date(nine + from * MIN).toISOString(),
  toAt: new Date(nine + to * MIN).toISOString(),
  evidence: 'fixture',
})

describe('StatisticsInsights', () => {
  it('counts a focus session across a one-slot gap but not the gap', () => {
    // 30 min, a 10 min gap, 20 min: one session of 50 tracked minutes.
    const focus = StatisticsInsights.focusSessions([
      ...slots(0, 3),
      ...slots(40, 2),
    ])
    expect(focus).to.deep.equal({ count: 1, minutes: 50, longestMinutes: 50 })
  })

  it('splits sessions at a longer gap and drops short stretches', () => {
    // 50 min, then 11 min apart, then 40 min: only the first is focus.
    const first = slots(0, 5)
    const second = slots(61, 4)
    const focus = StatisticsInsights.focusSessions([...first, ...second])
    expect(focus).to.deep.equal({ count: 1, minutes: 50, longestMinutes: 50 })
  })

  it('places active time by weekday and hour in the reader timezone', () => {
    const rows = StatisticsInsights.hourly(
      [entry(slots(0, 1)[0]), entry(slots(10, 1)[0], null)],
      'Asia/Tokyo',
    )
    // 09:00 UTC Monday is 18:00 Monday in Tokyo; unmeasured time is left out.
    expect(rows).to.deep.equal([{ weekday: 1, hour: 18, activeSeconds: 420 }])
  })

  it('ranks productive hours across weekdays', () => {
    expect(
      StatisticsInsights.productiveHours([
        { weekday: 1, hour: 9, activeSeconds: 600 },
        { weekday: 2, hour: 9, activeSeconds: 600 },
        { weekday: 1, hour: 14, activeSeconds: 900 },
        { weekday: 3, hour: 7, activeSeconds: 0 },
      ]),
    ).to.deep.equal([9, 14])
  })

  it('compares activity and input with measured time only', () => {
    const me = StatisticsInsights.me(
      [entry(slots(0, 1)[0], 300), entry(slots(10, 1)[0], null)],
      'UTC',
    )
    expect(me.activeRatio).to.equal(0.5)
    // 100 keys and 20 clicks over 5 active minutes.
    expect(me.keysPerActiveHour).to.equal(1200)
    expect(me.clicksPerActiveHour).to.equal(240)
  })

  it('has no ratios for a period with nothing measured', () => {
    const me = StatisticsInsights.me([], 'UTC')
    expect(me.activeRatio).to.equal(null)
    expect(me.keysPerActiveHour).to.equal(null)
    expect(me.focus.count).to.equal(0)
  })

  it('splits running time into assisted and autonomous, wait apart', () => {
    const rows = StatisticsInsights.agentDaily(
      [
        {
          userId: 'u',
          projectId: 'p',
          agentId: 'a',
          product: 'claude-code',
          status: 'completed',
          segments: [
            segment('running', 0, 30),
            segment('human_wait', 30, 40),
            segment('running', 40, 60),
          ],
        },
        // The same agent overlapping itself counts once.
        {
          userId: 'u',
          projectId: 'p',
          agentId: 'a',
          product: 'claude-code',
          status: 'completed',
          segments: [segment('running', 50, 60)],
        },
      ],
      // The worker's own timer ran for the first 20 minutes, and on another
      // project later, which does not assist this one.
      [
        { userId: 'u', projectId: 'p', span: [nine, nine + 20 * MIN] },
        { userId: 'u', projectId: 'q', span: [nine, nine + 60 * MIN] },
      ],
      [nine - 60 * MIN, nine + 120 * MIN],
      'UTC',
    )
    expect(rows).to.deep.equal([
      {
        day: '2026-10-19',
        product: 'claude-code',
        assistedSeconds: 20 * 60,
        autonomousSeconds: 30 * 60,
        waitSeconds: 10 * 60,
      },
    ])
  })

  it('cuts agent time at the reader midnight and the range edges', () => {
    const rows = StatisticsInsights.agentDaily(
      [
        {
          userId: 'u',
          projectId: 'p',
          agentId: 'a',
          product: 'codex',
          status: 'completed',
          // 23:30 to 00:30 in UTC+2 (21:30-22:30 UTC on the 19th).
          segments: [segment('running', 750, 810)],
        },
      ],
      [],
      // The range stops at 00:15 local, cutting the last 15 minutes.
      [nine - 600 * MIN, nine + 795 * MIN],
      'Etc/GMT-2',
    )
    expect(rows.map((row) => [row.day, row.autonomousSeconds])).to.deep.equal([
      ['2026-10-19', 30 * 60],
      ['2026-10-20', 15 * 60],
    ])
  })
})
