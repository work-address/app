import { describe, expect, it } from 'vitest'

import { canInvoiceProject, canManageProject } from './utils'

describe('what a role may do to a project', () => {
  it.each([
    ['owner', true, true],
    ['worker', false, true],
    ['viewer', false, false],
    [undefined, false, false],
  ] as const)('%s', (role, manages, invoices) => {
    expect(canManageProject(role)).toBe(manages)
    expect(canInvoiceProject(role)).toBe(invoices)
  })
})
