import { describe, expect, it } from 'vitest'

import {
  focusedProject,
  narrowToFocusedProject,
  readFocusedProjectParam,
} from './focused-project'

const MINE = 'c1a2b3c4-0000-4000-8000-000000000001'
const SOMEONE_ELSES = 'd4e5f6a7-0000-4000-8000-000000000002'

describe('readFocusedProjectParam', () => {
  it('reads the project id the marketplace links with', () => {
    expect(readFocusedProjectParam(`?project=${MINE}`)).toBe(MINE)
    expect(
      readFocusedProjectParam(new URLSearchParams({ project: MINE })),
    ).toBe(MINE)
  })

  it('treats a missing or blank parameter as no link at all', () => {
    expect(readFocusedProjectParam('')).toBeNull()
    expect(readFocusedProjectParam('?tab=time')).toBeNull()
    expect(readFocusedProjectParam('?project=')).toBeNull()
    expect(readFocusedProjectParam('?project=%20%20')).toBeNull()
  })
})

describe('focusedProject', () => {
  it('shows the ordinary dashboard without a link', () => {
    expect(
      focusedProject({ param: null, visibleProjectIds: [MINE] }),
    ).toStrictEqual({ kind: 'none' })
  })

  it('selects a project this account can see', () => {
    expect(
      focusedProject({ param: MINE, visibleProjectIds: [SOMEONE_ELSES, MINE] }),
    ).toStrictEqual({ kind: 'focused', projectId: MINE })
  })

  it('refuses a project this account cannot see', () => {
    expect(
      focusedProject({ param: SOMEONE_ELSES, visibleProjectIds: [MINE] }),
    ).toStrictEqual({ kind: 'no-access', projectId: SOMEONE_ELSES })
  })

  /**
   * The list is empty before it is fetched. Answering "no access" from that
   * emptiness would deny the owner their own project on every visit, for as
   * long as the request takes.
   */
  it('does not deny access while the projects are still loading', () => {
    expect(
      focusedProject({ param: MINE, visibleProjectIds: null }),
    ).toStrictEqual({ kind: 'focused', projectId: MINE })
  })

  /** An account with no projects at all still cannot see someone else's. */
  it('refuses a link when the account has no projects', () => {
    expect(
      focusedProject({ param: SOMEONE_ELSES, visibleProjectIds: [] }),
    ).toStrictEqual({ kind: 'no-access', projectId: SOMEONE_ELSES })
  })
})

describe('narrowToFocusedProject', () => {
  const projects = [{ id: MINE }, { id: SOMEONE_ELSES }]

  it('leaves the list alone without a link', () => {
    expect(narrowToFocusedProject(projects, { kind: 'none' })).toStrictEqual(
      projects,
    )
  })

  it('narrows to the linked project', () => {
    expect(
      narrowToFocusedProject(projects, { kind: 'focused', projectId: MINE }),
    ).toStrictEqual([{ id: MINE }])
  })

  /**
   * Not a quiet fall back to the full list: that would leave someone who
   * followed a bad link believing they were looking at the project it named.
   */
  it('shows nothing when the link cannot be followed', () => {
    expect(
      narrowToFocusedProject(projects, {
        kind: 'no-access',
        projectId: 'e7f8a9b0-0000-4000-8000-000000000003',
      }),
    ).toStrictEqual([])
  })
})
