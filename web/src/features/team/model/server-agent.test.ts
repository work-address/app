import { describe, expect, it } from 'vitest'

import {
  agentSlug,
  eventsEndpoint,
  isAgentName,
  sendsPrompts,
  SERVER_PRODUCTS,
  serverCredentialRows,
  setupCommand,
  setupGuideUrl,
} from './server-agent'

import type { AgentCredential } from './types'

const SLUG = /^[\da-z][\da-z-]{0,59}$/

describe('agentSlug', () => {
  it('makes a handle from the name', () => {
    expect(agentSlug('OpenClaw (build server)', 'openclaw', [])).toBe(
      'openclaw-build-server',
    )
  })

  it('numbers a handle that is taken', () => {
    expect(agentSlug('Codex', 'codex', ['codex', 'codex-2'])).toBe('codex-3')
  })

  it('falls back to the product when the name has nothing to keep', () => {
    expect(agentSlug('сервер', 'hermes', [])).toBe('hermes')
  })

  it('stays within what the API accepts', () => {
    const long = 'a'.repeat(80)
    const slug = agentSlug(long, 'codex', [long.slice(0, 60)])

    expect(slug).toMatch(SLUG)
    expect(slug.endsWith('-2')).toBe(true)
  })
})

describe('isAgentName', () => {
  it('takes what the API takes', () => {
    expect(isAgentName('OpenClaw (server)')).toBe(true)
    expect(isAgentName('')).toBe(false)
    expect(isAgentName('a'.repeat(61))).toBe(false)
    expect(isAgentName('<b>')).toBe(false)
    expect(isAgentName('tab\there')).toBe(false)
  })
})

describe('SERVER_PRODUCTS', () => {
  it('leaves out OpenCode, whose adapter records nothing billable', () => {
    expect(SERVER_PRODUCTS).not.toContain('opencode')
  })
})

describe('sendsPrompts', () => {
  it('is true only of the runtimes whose hooks carry the prompt', () => {
    expect(SERVER_PRODUCTS.filter(sendsPrompts)).toEqual([
      'claude-code',
      'codex',
    ])
  })
})

describe('eventsEndpoint', () => {
  it('uses the API address', () => {
    expect(eventsEndpoint('https://api.address.work/', 'https://x.test')).toBe(
      'https://api.address.work/api/agent-tracking/events',
    )
  })

  it('uses the page origin when the API address is relative or missing', () => {
    expect(eventsEndpoint(undefined, 'https://address.work')).toBe(
      'https://address.work/api/agent-tracking/events',
    )
    expect(eventsEndpoint('/', 'https://address.work')).toBe(
      'https://address.work/api/agent-tracking/events',
    )
  })
})

describe('setupCommand', () => {
  it('names the endpoint, project and machine, and never the credential', () => {
    expect(
      setupCommand({
        endpoint: 'https://a/e',
        projectId: 'p',
        instanceId: 'i',
      }),
    ).toBe('agent-tracker setup https://a/e p i')
  })
})

describe('setupGuideUrl', () => {
  it('sends OpenClaw to its own plugin guide', () => {
    expect(setupGuideUrl('openclaw')).toContain('agent-tracker-openclaw')
    expect(setupGuideUrl('codex')).toContain('SERVER-RUNTIMES.md')
  })
})

describe('serverCredentialRows', () => {
  const now = Date.parse('2026-11-10T00:00:00Z')
  const credential = (
    overrides: Partial<AgentCredential> = {},
  ): AgentCredential => ({
    id: 'c1',
    instanceId: 'i1',
    label: 'Build server',
    mode: 'fixed',
    prefix: 'wa_agent_abc',
    createdAt: '2026-11-01T00:00:00Z',
    expiresAt: '2027-01-30T00:00:00Z',
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  })

  it('lists server credentials only, and not revoked ones', () => {
    const rows = serverCredentialRows(
      [
        credential(),
        credential({ id: 'c2', mode: 'timer' }),
        credential({ id: 'c3', revokedAt: '2026-11-02T00:00:00Z' }),
      ],
      now,
    )

    expect(rows.map((row) => row.id)).toEqual(['c1'])
    expect(rows[0].state).toBe('active')
  })

  it('says when a credential is about to expire or has', () => {
    const state = (expiresAt: string) =>
      serverCredentialRows([credential({ expiresAt })], now)[0].state

    expect(state('2026-11-20T00:00:00Z')).toBe('expiring')
    expect(state('2026-11-09T00:00:00Z')).toBe('expired')
  })
})
