import {
  CONTRACT_SCENARIOS,
  runScenario,
  type ContractAdapter,
  type ContractPerson,
  type ContractRequest,
} from '@work-address/api-contract'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { handlers } from './handlers'
import { DEMO_ACCESS_TOKEN } from './session'
import { demoDb } from './store'

import type { MockInvoice, MockProject, MockTime } from './db'

const server = setupServer(...handlers)

const HOUR = 3_600_000

const PEOPLE: Record<ContractPerson, string> = {
  owner: 'contract-owner',
  worker: 'contract-worker',
  viewer: 'contract-viewer',
  outsider: 'contract-outsider',
}

/** The demo's mock over MSW, held to what the API answers. */
const mock: ContractAdapter = {
  async seed() {
    const db = demoDb()
    const person = db.users[0]
    db.users = Object.values(PEOPLE).map((id) => ({
      ...person,
      id,
      address: `address-${id}`,
      premium: true,
    }))
    const project = (id: string, state: MockProject['state']): MockProject => ({
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: id,
      text: '',
      rateHour: '60',
      state,
      ownerId: PEOPLE.owner,
      workerIds: [PEOPLE.worker],
      viewerIds: [PEOPLE.viewer],
      trackScreenshots: false,
      trackProcesses: false,
      trackAgents: false,
      trackWindowTitles: false,
      trackBrowserDomains: false,
      allowManualTime: true,
      allowMobileTime: false,
      trackLocation: false,
      reviewWindowHours: 24,
      screenshotRetentionDays: null,
      deletedAt: null,
    })
    db.projects = [project('active', 'Active'), project('closed', 'Inactive')]
    const entry = (
      id: string,
      hoursAgo: number,
      fields: Partial<MockTime> = {},
    ): MockTime => ({
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: 'active',
      userId: PEOPLE.worker,
      fromAt: new Date(Date.now() - hoursAgo * HOUR - HOUR / 2).toISOString(),
      toAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
      isPaid: false,
      note: id,
      screenshot: null,
      appsStatus: 'ok',
      apps: [{ name: 'code', seconds: 60 }],
      source: 'desktop',
      locationStatus: null,
      locations: [],
      publishedAt: null,
      minutesActive: 5,
      keyboardKeys: 1,
      mouseKeys: 1,
      mouseDistance: 1,
      invoiceId: null,
      ...fields,
    })
    db.times = [
      entry('draft', 1),
      entry('old', 72),
      entry('loose', 100),
      entry('paid', 101, { isPaid: true }),
      entry('invoiced', 200, { invoiceId: 'invoice' }),
      entry('closed', 2, { projectId: 'closed' }),
      entry('own', 5, { userId: PEOPLE.owner }),
      entry('settled', 300, { invoiceId: 'settled' }),
    ]
    const invoice: MockInvoice = {
      id: 'invoice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: 'active',
      userId: PEOPLE.worker,
      fromAt: new Date(Date.now() - 201 * HOUR).toISOString(),
      toAt: new Date(Date.now() - 200 * HOUR).toISOString(),
      amountCents: 3000,
      rateHourCents: 6000,
      state: 'Requested',
      rejectionReason: null,
      rejectedAt: null,
      paidAt: null,
      timeIds: ['invoiced'],
    }
    db.invoices = [
      invoice,
      {
        ...invoice,
        id: 'settled',
        fromAt: new Date(Date.now() - 301 * HOUR).toISOString(),
        toAt: new Date(Date.now() - 300 * HOUR).toISOString(),
        state: 'PAID',
        paidAt: new Date().toISOString(),
        timeIds: ['settled'],
      },
    ]
    db.runs = []

    return {
      project: 'active',
      ownerId: PEOPLE.owner,
      workerId: PEOPLE.worker,
      draftEntry: 'draft',
      oldEntry: 'old',
      looseEntry: 'loose',
      paidEntry: 'paid',
      billableFromUnix: Date.now() - 102 * HOUR,
      billableToUnix: Date.now() - 99 * HOUR,
      invoicedEntry: 'invoiced',
      invoice: 'invoice',
      closedEntry: 'closed',
      ownerEntry: 'own',
      settledEntry: 'settled',
    }
  },

  async send(person: ContractPerson, request: ContractRequest) {
    demoDb().meId = PEOPLE[person]
    const response = await fetch(`http://demo.test/api${request.path}`, {
      method: request.method.toUpperCase(),
      headers: {
        authorization: DEMO_ACCESS_TOKEN,
        'content-type': 'application/json',
      },
      body:
        request.method === 'get'
          ? undefined
          : JSON.stringify(request.body ?? {}),
    })

    return { status: response.status, body: await response.json() }
  },
}

describe('demo mock contract', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  for (const scenario of CONTRACT_SCENARIOS) {
    it(scenario.name, async () => {
      expect(await runScenario(mock, scenario)).toBeUndefined()
    })
  }
})
