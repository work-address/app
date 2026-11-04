import { describe, expect, it, vi } from 'vitest'

import { sortProjects } from './projects-sort'

import type { ProjectWithStats } from '@/entities/projects'

vi.mock('@/shared', async () => import('@/shared/ui/table/sort-rows'))

const project = (fields: Partial<ProjectWithStats>) =>
  ({ id: fields.title, ...fields }) as ProjectWithStats

const titles = (rows: ProjectWithStats[]) => rows.map((row) => row.title)

describe('sortProjects', () => {
  it('orders names without regard to case, and numbers within them by value', () => {
    const rows = [
      project({ title: 'project 10' }),
      project({ title: 'Project 2' }),
      project({ title: 'alpha' }),
    ]

    expect(titles(sortProjects(rows, { title: 'ASC' }))).toEqual([
      'alpha',
      'Project 2',
      'project 10',
    ])
    expect(titles(sortProjects(rows, { title: 'DESC' }))).toEqual([
      'project 10',
      'Project 2',
      'alpha',
    ])
  })

  it('sorts the time column by its minutes', () => {
    const rows = [
      project({ title: 'a', minutes: 90 }),
      project({ title: 'b', minutes: 600 }),
      project({ title: 'c', minutes: 5 }),
    ]

    expect(titles(sortProjects(rows, { timeTotal: 'DESC' }))).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('keeps a project with no value last in both directions', () => {
    const rows = [
      project({ title: 'viewer', rateHour: undefined }),
      project({ title: 'cheap', rateHour: 10 }),
      project({ title: 'dear', rateHour: 90 }),
    ]

    expect(titles(sortProjects(rows, { rateHour: 'ASC' }))).toEqual([
      'cheap',
      'dear',
      'viewer',
    ])
    expect(titles(sortProjects(rows, { rateHour: 'DESC' }))).toEqual([
      'dear',
      'cheap',
      'viewer',
    ])
  })

  it('breaks ties by title in either direction', () => {
    const rows = [
      project({ title: 'b', state: 'Active' }),
      project({ title: 'a', state: 'Active' }),
    ]

    for (const order of ['ASC', 'DESC'] as const) {
      expect(titles(sortProjects(rows, { state: order }))).toEqual(['a', 'b'])
    }
  })

  it('does not reorder the array it was given', () => {
    const rows = [project({ title: 'b' }), project({ title: 'a' })]

    sortProjects(rows, { title: 'ASC' })

    expect(titles(rows)).toEqual(['b', 'a'])
  })
})
