import { describe, expect, it } from 'vitest'

import {
  CADENCE_WEEKDAY_KEYS,
  cadenceTimezoneOptions,
  cadenceWeekdayIndex,
  cadenceWeekdayKey,
  canEditProjectCadence,
  projectCadenceConsent,
  projectCadenceLocalReading,
  projectCadenceNextCutoff,
  projectCadenceNextIssue,
  projectCadenceState,
  type ProjectCadenceView,
} from './project-cadence'

/** Mondays at 09:00 New York time, as the API answers it. */
const view = (
  overrides: Partial<ProjectCadenceView> = {},
): ProjectCadenceView =>
  ({
    current: {
      weekday: 1,
      timezone: 'America/New_York',
      cutoffLocal: '09:00',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      finalizationDelayHours: 24,
    },
    versions: [
      {
        weekday: 1,
        timezone: 'America/New_York',
        cutoffLocal: '09:00',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        finalizationDelayHours: 24,
      },
    ],
    // Standard time: 09:00 in New York is 14:00Z.
    nextCutoff: '2026-03-02T14:00:00.000Z',
    nextIssueAt: '2026-03-03T14:00:00.000Z',
    consented: null,
    canEdit: false,
    ...overrides,
  }) as ProjectCadenceView

describe('project cadence', () => {
  it('has a translation key for every weekday the API can name', () => {
    expect(CADENCE_WEEKDAY_KEYS).toHaveLength(7)
    expect(cadenceWeekdayKey(1)).toBe('project.cadence.weekday.monday')
    expect(cadenceWeekdayKey(0)).toBe('project.cadence.weekday.sunday')
    expect(cadenceWeekdayKey(7)).toBeNull()
  })

  it('is off until the owner has stated a rule', () => {
    expect(projectCadenceState(null)).toBe('off')
    expect(projectCadenceState(view({ current: null, nextCutoff: null }))).toBe(
      'off',
    )
    expect(projectCadenceState(view())).toBe('scheduled')
  })

  it('shows the next cutoff as an instant', () => {
    expect(projectCadenceNextCutoff(view())?.toISOString()).toBe(
      '2026-03-02T14:00:00.000Z',
    )
    expect(projectCadenceNextIssue(view())?.toISOString()).toBe(
      '2026-03-03T14:00:00.000Z',
    )
    expect(projectCadenceNextCutoff(view({ nextCutoff: null }))).toBeNull()
    expect(projectCadenceNextCutoff(view({ nextCutoff: 'soon' }))).toBeNull()
  })

  /**
   * The reading is the rule people agreed to. The same 09:00 New York cutoff
   * is 14:00Z in standard time and 13:00Z once the clocks have gone forward,
   * and both have to read back as Monday 09:00.
   */
  it('reads the cutoff in the cadence zone on both sides of a spring forward', () => {
    expect(projectCadenceLocalReading(view())).toEqual({
      weekdayKey: 'project.cadence.weekday.monday',
      time: '09:00',
    })

    expect(
      projectCadenceLocalReading(
        view({ nextCutoff: '2026-03-09T13:00:00.000Z' }),
      ),
    ).toEqual({
      weekdayKey: 'project.cadence.weekday.monday',
      time: '09:00',
    })
  })

  it('reads a weekday number out of a named zone', () => {
    // 14:00Z on a Monday is still Sunday in Los Angeles at 06:00.
    const cutoff = new Date('2026-03-02T14:00:00.000Z')

    expect(cadenceWeekdayIndex(cutoff, 'America/New_York')).toBe(1)
    expect(
      cadenceWeekdayIndex(new Date('2026-03-02T02:00:00.000Z'), 'UTC'),
    ).toBe(1)
    expect(
      cadenceWeekdayIndex(
        new Date('2026-03-02T02:00:00.000Z'),
        'America/Los_Angeles',
      ),
    ).toBe(0)
  })

  it('has nothing to read without a cadence', () => {
    expect(projectCadenceLocalReading(null)).toBeNull()
    expect(
      projectCadenceLocalReading(view({ current: null, nextCutoff: null })),
    ).toBeNull()
  })

  /** Never asked is not the same as having said no. */
  it('separates an unanswered consent from a declined one', () => {
    expect(projectCadenceConsent(view())).toBe('unanswered')
    expect(projectCadenceConsent(view({ consented: false }))).toBe('declined')
    expect(projectCadenceConsent(view({ consented: true }))).toBe('consented')
    expect(projectCadenceConsent(null)).toBe('unanswered')
  })

  /** The owner states the rule; a worker sees it and answers for themselves. */
  it('offers the editor to the owner alone', () => {
    expect(canEditProjectCadence(view({ canEdit: true }))).toBe(true)
    expect(canEditProjectCadence(view())).toBe(false)
    expect(canEditProjectCadence(null)).toBe(false)
  })

  it('always offers the zone the project already uses', () => {
    const options = cadenceTimezoneOptions('America/New_York')

    expect(options.length).toBeGreaterThan(0)
    expect(options.map((option) => option.value)).toContain('America/New_York')
    expect(options[0]).toHaveProperty('label')
  })
})
