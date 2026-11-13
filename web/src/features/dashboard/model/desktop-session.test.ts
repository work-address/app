import { describe, expect, it } from 'vitest'

import { latestDesktopSession, type SessionEntry } from './desktop-session'

const ME = 'me'
const day = (time: string) => `2026-11-07T${time}:00.000Z`

const entry = (
  from: string,
  to: string,
  extra: Partial<SessionEntry> = {},
): SessionEntry => ({
  fromAt: day(from),
  toAt: day(to),
  source: 'desktop',
  note: 'Design polish',
  user: { id: ME },
  project: { id: 'web', title: 'Website update' },
  ...extra,
})

const options = { userId: ME, projectIds: ['web', 'app'] }

describe('latestDesktopSession', () => {
  it('joins entries with gaps of ten minutes or less into one session', () => {
    const session = latestDesktopSession(
      [
        entry('15:30', '16:00'),
        entry('14:30', '15:20'),
        entry('14:00', '14:30'),
        // Two hours earlier: another session.
        entry('11:00', '12:00'),
      ],
      options,
    )

    expect(session).toMatchObject({
      fromAt: new Date(day('14:00')),
      toAt: new Date(day('16:00')),
      minutes: 110,
      projectTitle: 'Website update',
      projectCount: 1,
      note: 'Design polish',
    })
  })

  it("leaves out other people's time, so it is never shown as yours", () => {
    const session = latestDesktopSession(
      [
        entry('15:00', '16:00', { user: { id: 'teammate' } }),
        entry('09:00', '10:00'),
      ],
      options,
    )

    expect(session?.toAt).toEqual(new Date(day('10:00')))
  })

  it('counts only tracked time, and unmarked entries as desktop', () => {
    const session = latestDesktopSession(
      [
        entry('15:00', '16:00', { source: 'manual' }),
        entry('14:00', '14:30', { source: 'web' }),
        entry('12:00', '13:00', { source: undefined }),
      ],
      options,
    )

    expect(session?.toAt).toEqual(new Date(day('13:00')))
    expect(session?.source).toBe('desktop')
  })

  it('shows a phone session as one, without the desktop time beside it', () => {
    const session = latestDesktopSession(
      [
        entry('15:00', '16:00', { source: 'mobile' }),
        // The desktop, five minutes earlier: not part of the phone's session.
        entry('14:00', '14:55'),
        entry('14:30', '14:55', { source: 'mobile' }),
      ],
      options,
    )

    expect(session).toMatchObject({
      source: 'mobile',
      fromAt: new Date(day('14:30')),
      toAt: new Date(day('16:00')),
      minutes: 85,
    })
  })

  it('keeps to the projects the dashboard shows', () => {
    expect(
      latestDesktopSession(
        [entry('15:00', '16:00', { project: { id: 'other' } })],
        options,
      ),
    ).toBeNull()
  })

  it('counts overlapping time once', () => {
    const session = latestDesktopSession(
      [entry('15:00', '16:00'), entry('15:30', '16:00')],
      options,
    )

    expect(session?.minutes).toBe(60)
  })

  it('names the latest project and the latest note, and counts projects', () => {
    const session = latestDesktopSession(
      [
        entry('15:00', '16:00', { note: '  ' }),
        entry('14:00', '15:00', {
          project: { id: 'app', title: 'Mobile app' },
          note: 'Checkout flow',
        }),
      ],
      options,
    )

    expect(session).toMatchObject({
      projectId: 'web',
      projectTitle: 'Website update',
      projectCount: 2,
      note: 'Checkout flow',
    })
  })

  it('has nothing to show without your desktop time', () => {
    expect(latestDesktopSession([], options)).toBeNull()
    expect(
      latestDesktopSession([entry('15:00', '16:00')], {
        ...options,
        userId: null,
      }),
    ).toBeNull()
  })
})
