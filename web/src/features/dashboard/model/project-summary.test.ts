import { describe, expect, it } from 'vitest'

import { projectSummary, type ProjectWithAccess } from './project-summary'

const project = {
  id: 'p',
  title: 'Site',
  role: 'worker',
  rateHour: 60,
  minutes: 600,
  minutesActive: 400,
  minutesPaid: 300,
  minutesUnpaid: 300,
  paidCents: 30_000,
  keyboardKeys: 9000,
  mouseKeys: 1200,
  mouseDistance: 45_000,
  state: 'Active',
  trackScreenshots: true,
  trackProcesses: false,
  trackAgents: true,
  allowManualTime: false,
  reviewWindowHours: 12,
  user: { id: 'owner', name: 'Olga' },
  workers: [
    { id: 'me', name: 'Ivan' },
    { id: 'w2', address: '0xabc' },
  ],
  viewers: [{ id: 'v' }],
} as unknown as ProjectWithAccess

describe('project summary', () => {
  it('reads the period, all time, the team and the tracking for a worker', () => {
    const summary = projectSummary(
      project,
      {
        projectId: 'p',
        trackedSeconds: 7200,
        activeSeconds: 3600,
        paidSeconds: 1800,
        unpaidSeconds: 5400,
        earnedCents: 12_000,
        unpaidCents: 9000,
      },
      [
        { projectId: 'p', app: 'Slack', seconds: 600 },
        { projectId: 'p', app: 'Code', seconds: 1800 },
        { projectId: 'other', app: 'Figma', seconds: 900 },
      ],
      [
        { day: '2026-10-24T09', projectId: 'p', trackedSeconds: 3600 },
        { day: '2026-10-24T10', projectId: 'p', trackedSeconds: 1800 },
        { day: '2026-10-25T09', projectId: 'p', trackedSeconds: 1800 },
      ],
    )

    expect(summary.role).toBe('worker')
    expect(summary.rate).toBe(60)
    expect(summary.status).toBe('Active')
    expect(summary.allTime).toMatchObject({
      paidCents: 30_000,
      keyboardKeys: 9000,
      mouseKeys: 1200,
      mouseDistance: 45_000,
    })
    expect(summary.period).toEqual({
      trackedMinutes: 120,
      activeMinutes: 60,
      activeShare: 0.5,
      paidMinutes: 30,
      unpaidMinutes: 90,
      earnedCents: 12_000,
      unpaidCents: 9000,
      days: 2,
    })
    expect(summary.team).toEqual({
      owner: 'Olga',
      workers: ['Ivan', '0xabc'],
      viewers: 1,
    })
    expect(summary.apps.map((app) => app.name)).toEqual(['Code', 'Slack'])
    expect(summary.tracking).toEqual({
      screenshots: true,
      apps: false,
      agents: true,
      manual: false,
      reviewWindowHours: 12,
    })
  })

  it('keeps activity and money from someone who only views', () => {
    const summary = projectSummary(
      { ...project, role: 'viewer', rateHour: undefined },
      { projectId: 'p', trackedSeconds: 3600 },
      [],
      [],
    )

    expect(summary.role).toBe('viewer')
    expect(summary.period).toMatchObject({
      trackedMinutes: 60,
      activeMinutes: null,
      earnedCents: null,
      unpaidCents: null,
    })
    expect(summary.rate).toBeNull()
    expect(summary.allTime.paidCents).toBeNull()
  })
})
