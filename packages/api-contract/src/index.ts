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
  /** The people, for filters that name them. */
  ownerId: string
  workerId: string
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
  /** The owner's, 30 minutes. */
  ownerEntry: string
  /** The worker's, 30 minutes, on a paid invoice of 3000 cents, un-marked by hand. */
  settledEntry: string
}

export interface ContractRequest {
  method: 'get' | 'post' | 'put' | 'delete'
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
  send(
    person: ContractPerson,
    request: ContractRequest,
  ): Promise<ContractResponse>
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

const searchWhere = (filter: Record<string, unknown>): ContractRequest => ({
  method: 'post',
  path: '/time/search',
  body: { filter, sort: { fromAt: 'DESC' }, page: 0, limit: 100 },
})

/* eslint-disable @typescript-eslint/no-explicit-any */
const entry = (body: any, id: string) =>
  (body[0] as any[]).find((row) => row.id === id)
const rowOf = (rows: any, world: ContractWorld) =>
  (rows as any[]).find((row) => row.projectId === world.project)
/* eslint-enable @typescript-eslint/no-explicit-any */

/** What must differ from the row, or nothing. Absent fields must be absent. */
const rowIs =
  (expected: Record<string, unknown>) =>
  (row: Record<string, unknown> | undefined, world: ContractWorld) => {
    const want: Record<string, unknown> = {
      ...expected,
      projectId: world.project,
    }
    const keys = [...new Set([...Object.keys(want), ...Object.keys(row ?? {})])]
    const wrong = keys.filter((key) => row?.[key] !== want[key])
    return wrong.length
      ? `${wrong.map((key) => `${key} is ${JSON.stringify(row?.[key])}`).join(', ')}, not ${JSON.stringify(wrong.map((key) => want[key]))}`
      : undefined
  }

/** A row without its activity figures, which depend on the seed's entries. */
const moneyOf = (row: Record<string, unknown> | undefined) => {
  const { minutesActive, keyboardKeys, mouseKeys, mouseDistance, ...money } =
    row ?? {}
  return money
}

const allTime = (w: ContractWorld): ContractRequest => ({
  method: 'get',
  path: `/time/totals/${w.project}/project`,
})

const overview = (w: ContractWorld): ContractRequest => ({
  method: 'post',
  path: '/statistics/overview',
  body: statistics({ projectIds: [w.project] }),
})

const projectRead = (w: ContractWorld): ContractRequest => ({
  method: 'post',
  path: '/project/search',
  body: { filter: { projectId: w.project }, sort: { id: 'ASC' }, page: 0 },
})

const noteIs =
  (id: keyof ContractWorld, note: string | null) =>
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

  // Entries: SPEC.md "Time.isPaid is set by an invoice or by its author"
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
    name: 'an entry on an invoice can be marked paid by hand',
    as: 'worker',
    request: (w) => ({
      method: 'post',
      path: '/time/paid',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 200,
  },
  {
    name: 'only its author can mark an entry paid by hand',
    as: 'owner',
    request: (w) => ({
      method: 'post',
      path: '/time/paid',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 403,
  },

  // Invoiced entries: SPEC.md "An invoiced entry keeps its detail"
  {
    name: 'an author deletes an entry on no invoice',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time',
      body: { ids: [w.looseEntry] },
    }),
    status: 200,
  },
  {
    name: 'an invoiced entry cannot be deleted',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 400,
  },
  {
    name: 'a batch with an invoiced entry in it is refused whole',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time',
      body: { ids: [w.looseEntry, w.invoicedEntry] },
    }),
    status: 400,
  },
  {
    name: 'only its author can delete an entry',
    as: 'owner',
    request: (w) => ({
      method: 'delete',
      path: '/time',
      body: { ids: [w.looseEntry] },
    }),
    status: 403,
  },
  {
    name: 'an author removes a screenshot from an entry on no invoice',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time/screenshots',
      body: { ids: [w.looseEntry] },
    }),
    status: 200,
  },
  {
    name: 'an invoiced entry keeps its screenshot',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time/screenshots',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 400,
  },
  {
    name: 'an invoiced entry keeps its apps',
    as: 'worker',
    request: (w) => ({
      method: 'delete',
      path: '/time/processes',
      body: { ids: [w.invoicedEntry] },
    }),
    status: 400,
  },
  {
    name: 'an invoiced entry keeps its note',
    as: 'worker',
    request: (w) => ({
      method: 'put',
      path: `/time/${w.invoicedEntry}`,
      body: { note: 'changed' },
    }),
    status: 400,
  },
  {
    name: 'an edit may carry an invoiced entry’s same note with a paid change',
    as: 'worker',
    request: (w) => ({
      method: 'put',
      path: `/time/${w.invoicedEntry}`,
      body: { note: 'invoiced', isPaid: true },
    }),
    status: 200,
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
    name: 'a viewer lists no entries',
    as: 'viewer',
    request: search,
    status: 200,
    check: (body) =>
      body[0].length === 0 ? undefined : `lists ${body[0].length} entries`,
  },
  {
    name: 'the search narrows to the people asked for',
    as: 'owner',
    request: (w) => searchWhere({ userIds: [w.workerId] }),
    status: 200,
    check: (body, w) =>
      entry(body, w.draftEntry) && !entry(body, w.ownerEntry)
        ? undefined
        : 'did not list the worker alone',
  },
  {
    name: 'naming a person shows a viewer no entries either',
    as: 'viewer',
    request: (w) => searchWhere({ userIds: [w.workerId] }),
    status: 200,
    check: (body) =>
      body[0].length === 0 ? undefined : `lists ${body[0].length} entries`,
  },
  {
    name: 'the search narrows to the projects asked for',
    as: 'owner',
    request: (w) => searchWhere({ projectIds: [w.project] }),
    status: 200,
    check: (body, w) =>
      entry(body, w.draftEntry) &&
      (body[0] as { project?: { id?: string } }[]).every(
        (row) => row.project?.id === w.project,
      )
        ? undefined
        : 'listed another project, or none of this one',
  },
  {
    name: 'empty people and project lists narrow nothing',
    as: 'owner',
    request: () => searchWhere({ userIds: [], projectIds: [] }),
    status: 200,
    check: (body, w) =>
      entry(body, w.draftEntry) && entry(body, w.ownerEntry)
        ? undefined
        : 'an empty list hid entries',
  },
  {
    name: 'the search narrows to the source asked for',
    as: 'owner',
    request: () => searchWhere({ source: 'desktop' }),
    status: 200,
    check: (body, w) =>
      entry(body, w.ownerEntry) ? undefined : 'did not list desktop time',
  },
  {
    name: 'a source nothing came from lists nothing',
    as: 'owner',
    request: () => searchWhere({ source: 'manual' }),
    status: 200,
    check: (body) =>
      body[0].length === 0 ? undefined : `lists ${body[0].length} entries`,
  },
  {
    name: 'a viewer cannot read an entry',
    as: 'viewer',
    request: (w) => ({ method: 'get', path: `/time/${w.oldEntry}` }),
    status: 403,
  },
  {
    name: 'a worker lists their own entries and nobody else’s',
    as: 'worker',
    request: search,
    status: 200,
    check: (body, world) =>
      entry(body, world.ownerEntry)
        ? 'lists the owner’s entry'
        : entry(body, world.oldEntry)
          ? undefined
          : 'does not list their own entry',
  },
  {
    name: 'a worker cannot read someone else’s entry',
    as: 'worker',
    request: (w) => ({ method: 'get', path: `/time/${w.ownerEntry}` }),
    status: 403,
  },
  {
    name: 'the owner lists everyone’s entries',
    as: 'owner',
    request: search,
    status: 200,
    check: (body, world) =>
      entry(body, world.ownerEntry) && entry(body, world.oldEntry)
        ? undefined
        : 'does not list both',
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

  // Project totals: SPEC.md "Who can see what"
  {
    name: 'a viewer’s all-time totals are the project’s time and nothing else',
    as: 'viewer',
    request: allTime,
    status: 200,
    check: (body, world) => rowIs({ minutes: 210 })(rowOf(body, world), world),
  },
  {
    name: 'a worker’s all-time totals count their own time and money',
    as: 'worker',
    request: allTime,
    status: 200,
    check: (body, world) =>
      rowIs({
        minutes: 180,
        minutesPaid: 30,
        minutesUnpaid: 150,
        rateHour: 60,
        earnedCents: 18000,
        // The paid invoice, and one hand-marked half hour at $60/h.
        paidCents: 6000,
        unpaidCents: 15000,
      })(moneyOf(rowOf(body, world)), world),
  },
  {
    name: 'the owner’s all-time totals count everyone',
    as: 'owner',
    request: allTime,
    status: 200,
    check: (body, world) =>
      rowIs({
        minutes: 210,
        minutesPaid: 30,
        minutesUnpaid: 180,
        rateHour: 60,
        earnedCents: 21000,
        paidCents: 6000,
        unpaidCents: 18000,
      })(moneyOf(rowOf(body, world)), world),
  },
  {
    name: 'an outsider reads no totals',
    as: 'outsider',
    request: allTime,
    status: 403,
  },
  {
    name: 'a viewer’s project read says their role and leaves out the rate',
    as: 'viewer',
    request: projectRead,
    status: 200,
    check: (body) => {
      const [project] = body[0]
      if (project?.role !== 'viewer') return `role is ${project?.role}`
      return 'rateHour' in project ? 'carries rateHour' : undefined
    },
  },
  ...(['owner', 'worker'] as const).map(
    (role): ContractScenario => ({
      name: `a ${role}’s project read says their role and carries the rate`,
      as: role,
      request: projectRead,
      status: 200,
      check: (body) => {
        const [project] = body[0]
        if (project?.role !== role) return `role is ${project?.role}`
        return Number(project.rateHour) === 60
          ? undefined
          : `rateHour is ${project.rateHour}`
      },
    }),
  ),

  // Reports: SPEC.md "Who can see what"
  {
    name: 'a viewer’s period totals are the project’s time and nothing else',
    as: 'viewer',
    request: overview,
    status: 200,
    check: (body, world) =>
      rowIs({ trackedSeconds: 12600 })(rowOf(body.totals, world), world),
  },
  {
    name: 'a worker’s period totals count their own time and money',
    as: 'worker',
    request: overview,
    status: 200,
    check: (body, world) => {
      const row = rowOf(body.totals, world)
      return row?.trackedSeconds === 10800 && row?.paidCents === 6000
        ? undefined
        : `tracked ${row?.trackedSeconds}, paid ${row?.paidCents}`
    },
  },
  {
    name: 'the owner’s period totals count everyone',
    as: 'owner',
    request: overview,
    status: 200,
    check: (body, world) => {
      const row = rowOf(body.totals, world)
      return row?.trackedSeconds === 12600 && row?.paidCents === 6000
        ? undefined
        : `tracked ${row?.trackedSeconds}, paid ${row?.paidCents}`
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
