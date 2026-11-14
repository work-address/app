import {
  AGENT_SUPPORT,
  type AgentLimit,
  type AgentServerSupport,
  type AgentSupportStatus,
} from '@work-address/agent-tracking-contract/support'

import type {
  AgentCredential,
  ServerCredentialRow,
  ServerCredentialState,
} from './types'

/**
 * Runtimes whose collector adapter records run boundaries, in the order
 * offered: every agent the shared support list records on servers. OpenCode's
 * reports session status only, which bills nothing, so it is not listed.
 */
export const SERVER_PRODUCTS = [
  'claude-code',
  'codex',
  'openclaw',
  'hermes',
  'kimi-code',
] as const

export type ServerProduct = (typeof SERVER_PRODUCTS)[number]

const support = (product: ServerProduct): AgentServerSupport => {
  const found = AGENT_SUPPORT.find((agent) => agent.product === product)

  if (!found) {
    throw new Error(`No support entry for ${product}`)
  }

  return found.servers
}

/** Brand names, so they are not translated. */
export const SERVER_PRODUCT_NAMES = Object.fromEntries(
  SERVER_PRODUCTS.map((product) => [
    product,
    AGENT_SUPPORT.find((agent) => agent.product === product)?.name ?? product,
  ]),
) as Record<ServerProduct, string>

/** Runtimes whose collector sends the prompt that starts a run. */
export const sendsPrompts = (product: ServerProduct): boolean =>
  support(product).prompts

/** Available once the agent passed its live check on servers; else experimental. */
export const serverStatus = (product: ServerProduct): AgentSupportStatus =>
  support(product).status

/** The gaps the agent's server recording is known to have. */
export const serverLimits = (product: ServerProduct): AgentLimit[] =>
  support(product).limits

/** Agent releases the live check passed on; empty until one did. */
export const serverVersions = (product: ServerProduct): string[] =>
  support(product).versions

/** What to run on the server before the setup command, one line per step. */
export const installCommand = (product: ServerProduct): string =>
  support(product).install.join('\n')

const REPOSITORY = 'https://github.com/work-address/app/blob/main'

/** Where the collector's install steps for a runtime are written down. */
export const setupGuideUrl = (product: ServerProduct): string =>
  `${REPOSITORY}/${support(product).guide}`

/** What the API takes as a name: 1 to 60 characters, no markup, no control codes. */
export const isAgentName = (name: string): boolean =>
  name.length > 0 &&
  name.length <= 60 &&
  !/[<>]/.test(name) &&
  [...name].every((char) => char.charCodeAt(0) > 31)

const MAX_SLUG = 60

/**
 * A handle the API accepts (`[a-z0-9][a-z0-9-]{0,59}`) that none of the
 * reader's agents holds, removed ones included: the API keeps theirs taken.
 * A name with no Latin letters or digits falls back to the product.
 */
export const agentSlug = (
  name: string,
  product: string,
  taken: string[],
): string => {
  const plain = (value: string) =>
    value
      .normalize('NFKD')
      .toLowerCase()
      .replaceAll(/[^\da-z]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')

  const base = plain(name) || plain(product) || 'agent'
  const used = new Set(taken)

  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `-${n}`
    const slug =
      base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/, '') + suffix

    if (!used.has(slug)) {
      return slug
    }
  }
}

/**
 * The address the collector uploads to. A relative or missing API address
 * means the API is served from the page's own origin.
 */
export const eventsEndpoint = (
  apiUrl: string | undefined,
  origin: string,
): string => {
  const base = new URL(apiUrl || '/', origin)

  return `${base.origin}${base.pathname.replace(/\/+$/, '')}/api/agent-tracking/events`
}

/** The collector reads the credential from stdin, so it is never in this line. */
export const setupCommand = (setup: {
  endpoint: string
  projectId: string
  instanceId: string
}): string =>
  `agent-tracker setup ${setup.endpoint} ${setup.projectId} ${setup.instanceId}`

const EXPIRING_MS = 14 * 86_400_000

/**
 * The servers' credentials that still matter. Desktop apps renew their own and
 * are not listed; a revoked one is gone for good.
 */
export const serverCredentialRows = (
  credentials: AgentCredential[],
  now: number,
): ServerCredentialRow[] =>
  credentials
    .filter(
      (credential) => credential.mode === 'fixed' && !credential.revokedAt,
    )
    .map((credential) => {
      const left = Date.parse(credential.expiresAt) - now
      const state: ServerCredentialState =
        left <= 0 ? 'expired' : left <= EXPIRING_MS ? 'expiring' : 'active'

      return {
        id: credential.id,
        instanceId: credential.instanceId,
        label: credential.label,
        prefix: credential.prefix,
        expiresAt: credential.expiresAt,
        lastUsedAt: credential.lastUsedAt,
        state,
        health: credential.health ?? null,
        lastHealthAt: credential.lastHealthAt ?? null,
      }
    })

export {
  type AgentLimit,
  type AgentSupportStatus,
} from '@work-address/agent-tracking-contract/support'
