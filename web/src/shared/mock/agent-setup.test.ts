import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { handlers } from './handlers'
import { DEMO_ACCESS_TOKEN } from './session'
import { demoDb } from './store'

const server = setupServer(...handlers)

const INSTANCE = '4c8b5f0e-6a53-4f0b-9c1e-2f1d5a7e9b10'

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fetch(`http://demo.test/api${path}`, {
    method,
    headers: {
      authorization: DEMO_ACCESS_TOKEN,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return { status: response.status, body: await response.json() }
}

const agent = (overrides: Record<string, unknown> = {}) => ({
  name: 'OpenClaw (server)',
  slug: 'openclaw-server',
  product: 'openclaw',
  isDefault: false,
  bindings: [INSTANCE],
  ...overrides,
})

/** The demo's server-agent setup, held to what the API's routes answer. */
describe('server agent setup in the demo', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  it('makes the first agent of a product its default, as the API does', async () => {
    const created = await call('post', '/agents', agent())

    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({
      name: 'OpenClaw (server)',
      slug: 'openclaw-server',
      product: 'openclaw',
      isDefault: true,
      bindings: [INSTANCE],
      removedAt: null,
    })
    expect(created.body.id).toMatch(/^[\da-f-]{36}$/)
    expect(created.body).not.toHaveProperty('userId')

    const listed = await call('get', '/agents')

    expect(listed.body).toContainEqual(
      expect.objectContaining({ id: created.body.id, slug: 'openclaw-server' }),
    )
  })

  it('refuses what the API refuses', async () => {
    const refused = async (overrides: Record<string, unknown>) =>
      (await call('post', '/agents', agent(overrides))).status

    expect(await refused({ slug: 'openclaw-server' })).toBe(400)
    expect(await refused({ slug: 'other', bindings: [INSTANCE] })).toBe(400)
    expect(await refused({ slug: 'Not A Slug', bindings: [] })).toBe(400)
    expect(await refused({ slug: 'x', name: '<b>', bindings: [] })).toBe(400)
    expect(await refused({ slug: 'y', product: 'nope', bindings: [] })).toBe(
      400,
    )
  })

  it('attaches a hand-made agent and shows it on the team', async () => {
    const db = demoDb()
    const project = db.projects.find((p) => p.ownerId === db.meId)!
    const mine = db.agents.find((row) => row.userId === db.meId)!

    const attached = await call(
      'put',
      `/project/${project.id}/agents/${mine.id}`,
      { rateHourCents: 1250 },
    )

    expect(attached.status).toBe(200)

    const team = await call('get', '/team')
    const me = team.body.projects
      .find((p: { id: string }) => p.id === project.id)
      .people.find((person: { userId: string }) => person.userId === db.meId)

    expect(me.agents).toContainEqual(
      expect.objectContaining({ id: mine.id, rateHourCents: 1250 }),
    )
  })

  it('issues a credential once, lists it without the secret, and revokes it', async () => {
    const issued = await call('post', '/agent-tracking/credentials', {
      instanceId: INSTANCE,
      mode: 'fixed',
      label: 'OpenClaw (server)',
    })

    expect(issued.body.credential).toMatch(/^wa_agent_[\da-f]{64}$/)

    const listed = await call('get', '/agent-tracking/credentials')
    const row = listed.body.find(
      (credential: { id: string }) => credential.id === issued.body.id,
    )

    expect(row).toMatchObject({
      instanceId: INSTANCE,
      mode: 'fixed',
      prefix: issued.body.credential.slice(0, 12),
      revokedAt: null,
    })
    expect(row).not.toHaveProperty('credential')
    expect(row).not.toHaveProperty('userId')

    await call('delete', `/agent-tracking/credentials/${issued.body.id}`)

    const after = await call('get', '/agent-tracking/credentials')

    expect(
      after.body.find(
        (credential: { id: string }) => credential.id === issued.body.id,
      ).revokedAt,
    ).not.toBeNull()
  })

  it('refuses a credential for something that is not a machine', async () => {
    const refused = await call('post', '/agent-tracking/credentials', {
      instanceId: 'laptop',
      mode: 'fixed',
    })

    expect(refused.status).toBe(400)
  })
})
