/**
 * What the API and the web demo's mock must both answer. Each runs these through
 * its own adapter: real HTTP and Postgres in api/src/test/contract, MSW in
 * web/src/shared/mock/contract.test.ts. Where they differ the API is right,
 * unless SPEC.md says otherwise.
 */
export type ContractPerson = 'owner' | 'worker' | 'viewer' | 'outsider'

/** Ids of a small world every scenario starts from, rate $60/h, 24 h review. */
export interface ContractWorld {
  project: string
  /** The worker's, inside the review window, note 'draft'. */
  draftEntry: string
  /** The worker's, past the review window, note 'old'. */
  oldEntry: string
  /** The worker's, 30 minutes, on no invoice, in `billableFromUnix`..`ToUnix`. */
  looseEntry: string
  /** The worker's, in that range too, already marked paid by hand. */
  paidEntry: string
  billableFromUnix: number
  billableToUnix: number
  /** The worker's, on `invoice`. */
  invoicedEntry: string
  /** Requested, issued by the worker. */
  invoice: string
  /** The worker's, on a project that is closed. */
  closedEntry: string
}

export interface ContractRequest {
  method: 'get' | 'post' | 'put'
  path: string
  body?: unknown
}

export interface ContractResponse {
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

export interface ContractAdapter {
  seed(): Promise<ContractWorld>
  send(person: ContractPerson, request: ContractRequest): Promise<ContractResponse>
}

export interface ContractScenario {
  name: string
  as: ContractPerson
  request: (world: ContractWorld) => ContractRequest
  status: number
  /** What must hold of the body; returns what is wrong, or nothing. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check?: (body: any, world: ContractWorld) => string | undefined
}

const DAY_MS = 86_400_000
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10)
const statistics = (extra: Record<string, unknown> = {}) => ({
  from: day(-30),
  to: day(1),
  timeZone: 'UTC',
  ...extra,
})

const search = (): ContractRequest => ({
  method: 'post',
  path: '/time/search',
  body: { filter: {}, sort: { fromAt: 'DESC' }, page: 0, limit: 100 },
})

/* eslint-disable @typescript-eslint/no-explicit-any */
const entry = (body: any, id: string) =>
  (body[0] as any[]).find((row) => row.id === id)
/* eslint-enable @typescript-eslint/no-explicit-any */

const noteIs = (id: keyof ContractWorld, note: string | null) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (body: any, world: ContractWorld) => {
    const row = entry(body, world[id] as string)
    if (!row) return `${id} is not listed`
    return (row.note ?? null) === note
      ? undefined
      : `${id} has note ${JSON.stringify(row.note)}, not ${JSON.stringify(note)}`
  }

export const CONTRACT_SCENARIOS: ContractScenario[] = [
  // Invoices: SPEC.md "Only the issuer may mark an invoice paid", "Only the
  // owner may reject an invoice", "A viewer sees no invoices"
  {
    name: 'the issuer marks their invoice paid',
    as: 'worker',
    request: (w) => ({ method: 'post', path: `/invoice/${w.invoice}/paid` }),
    status: 200,
  },
  {
    name: 'the owner cannot mark a worker’s invoice paid',
    as: 'owner',
    request: (w) => ({ method: 'post', path: `/invoice/${w.invoice}/paid` }),
    status: 403,
  },
  {
    name: 'the owner rejects a requested invoice',
    as: 'owner',
    request: (w) => ({ method: 'post', path: `/invoice/${w.invoice}/reject` }),
    status: 200,
  },
  {
    name: 'the issuer cannot reject their own invoice',
    as: 'worker',
    request: (w) => ({ method: 'post', path: `/invoice/${w.invoice}/reject` }),
    status: 403,
  },
  {
    name: 'a viewer cannot read an invoice',
    as: 'viewer',
    request: (w) => ({ method: 'get', path: `/invoice/${w.invoice}` }),
    status: 403,
  },
  {
    name: 'an invoice bills each unpaid entry’s own span in the period',
    as: 'worker',
    request: (w) => ({
      method: 'post',
      path: `/invoice/project/${w.project}`,
      body: { fromUnix: w.billableFromUnix, toUnix: w.billableToUnix },
    }),
    status: 200,
    check: (body) =>
      body.amountCents === 3000
        ? undefined
        : `amountCents is ${body.amountCents}, not 3000`,
  },

  // Entries: SPEC.md "Time.isPaid is owned by Invoice"
  {
    name: 'an author edits their own entry',
    as: 'worker',
    request: (w) => ({
      method: 'put',
      path: `/time/${w.draftEntry}`,
      body: { note: 'changed' },
    }),
    status: 200,
  },
  {
    name: 'the owner cannot edit a worker’s entry',
    as: 'owner',
    request: (w) => ({
      method: 'put',
      path: `/time/${w.draftEntry}`,
      body: { note: 'changed' },
    }),
    status: 403,
  },
  {
    name: 'an entry on no invoice can be marked paid by hand',
    as: 'worker',
    request: (w) => ({
      method: 'post',
      path: '/time/paid',
      body: { ids: [w.looseEntry] },
    }),
    status: 200,
  },
  {
    name: 'an entry on an invoice cannot be marked paid by hand',
    as: 'worker',
    request: (w) => ({
      method: 'post',
      path: '/time/paid',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 400,
  },

  // Detail: SPEC.md "Detail waits for the worker's review"
  {
    name: 'an author sees their own detail before review',
    as: 'worker',
    request: search,
    status: 200,
    check: noteIs('draftEntry', 'draft'),
  },
  {
    name: 'the owner does not see detail before review',
    as: 'owner',
    request: search,
    status: 200,
    check: noteIs('draftEntry', null),
  },
  {
    name: 'the owner sees detail once the review window ends',
    as: 'owner',
    request: search,
    status: 200,
    check: noteIs('oldEntry', 'old'),
  },
  {
    name: 'a viewer sees project time without detail',
    as: 'viewer',
    request: search,
    status: 200,
    check: noteIs('oldEntry', null),
  },
  {
    name: 'an outsider sees nothing',
    as: 'outsider',
    request: search,
    status: 200,
    check: (body) =>
      body[0].length === 0 ? undefined : `lists ${body[0].length} entries`,
  },
  {
    name: 'a closed project’s entries are not listed',
    as: 'worker',
    request: search,
    status: 200,
    check: (body, world) =>
      entry(body, world.closedEntry) ? 'lists the closed entry' : undefined,
  },

  // Reports: SPEC.md "Who can see what"
  {
    name: 'a viewer’s totals carry no activity',
    as: 'viewer',
    request: () => ({
      method: 'post',
      path: '/statistics/overview',
      body: statistics(),
    }),
    status: 200,
    check: (body) => {
      if (!body.totals.length) return 'no totals'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return body.totals.some((row: any) => 'activeSeconds' in row)
        ? 'a total carries activeSeconds'
        : undefined
    },
  },
  {
    name: 'a viewer cannot read window titles',
    as: 'viewer',
    request: (w) => ({
      method: 'post',
      path: '/statistics/apps/titles',
      body: statistics({ projectIds: [w.project] }),
    }),
    status: 403,
  },
  {
    name: 'a worker cannot read the workers report',
    as: 'worker',
    request: (w) => ({
      method: 'post',
      path: '/statistics/apps/workers',
      body: statistics({ projectIds: [w.project] }),
    }),
    status: 403,
  },
  {
    name: 'the owner reads the workers report',
    as: 'owner',
    request: (w) => ({
      method: 'post',
      path: '/statistics/apps/workers',
      body: statistics({ projectIds: [w.project] }),
    }),
    status: 200,
  },
  {
    name: 'a viewer cannot read figures by invoice',
    as: 'viewer',
    request: (w) => ({
      method: 'post',
      path: '/statistics/overview',
      body: statistics({ projectIds: [w.project], invoiceId: w.invoice }),
    }),
    status: 403,
  },
]

/** Runs one scenario on a fresh world; returns what went wrong, or nothing. */
export async function runScenario(
  adapter: ContractAdapter,
  scenario: ContractScenario,
): Promise<string | undefined> {
  const world = await adapter.seed()
  const response = await adapter.send(scenario.as, scenario.request(world))

  if (response.status !== scenario.status) {
    return `status ${response.status}, not ${scenario.status}: ${JSON.stringify(response.body)?.slice(0, 200)}`
  }

  return scenario.check?.(response.body, world)
}
