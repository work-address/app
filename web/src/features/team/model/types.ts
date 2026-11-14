import type { ServerProduct } from './server-agent'

export type TeamRole = 'owner' | 'worker' | 'viewer'

export type TeamAgent = {
  id: string
  name: string
  product: string
  rateHourCents: number
  attachedAt: string
  lastRateChange: { at: string; fromCents: number; toCents: number } | null
}

export type TeamPerson = {
  address: string
  /** Null until this address has signed in: a list entry needs no account. */
  userId: string | null
  name: string | null
  role: TeamRole
  agents: TeamAgent[]
}

export type TeamProjectData = {
  id: string
  title: string
  state: string
  role: 'owner' | 'worker'
  trackAgents: boolean
  people: TeamPerson[]
}

export type Team = {
  viewerOnly: boolean
  projects: TeamProjectData[]
}

/** One of the reader's own agents, as `GET /agents` holds it. */
export type OwnAgent = {
  id: string
  name: string
  /** The handle `WORK_ADDRESS_AGENT` names; unique among the reader's agents. */
  slug: string
  product: string
  removedAt: string | null
  /** The machines whose runs go to this agent: a server's own id among them. */
  bindings?: string[]
}

/** A machine's upload credential, as `GET /agent-tracking/credentials` lists it. */
export type AgentCredential = {
  id: string
  instanceId: string
  label: string
  mode: 'timer' | 'fixed'
  prefix: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  lastUsedAt: string | null
  /** What the collector last said of itself; null until it has. */
  health?: CollectorHealth | null
  lastHealthAt?: string | null
}

/** A collector's own account of its queue, sent with its uploads. */
export type CollectorHealth = {
  queued: number
  rejected: number
  lost: number
  heldRuns: number
  lastSuccessfulUploadAt?: string
}

export type ServerCredentialState = 'active' | 'expiring' | 'expired'

export type ServerCredentialRow = {
  id: string
  instanceId: string
  label: string
  prefix: string
  expiresAt: string
  lastUsedAt: string | null
  state: ServerCredentialState
  health: CollectorHealth | null
  lastHealthAt: string | null
}

/** What the setup dialog asks for. */
export type ServerAgentForm = {
  product: ServerProduct
  name: string
  projectId: string
  rateHourCents: number
}

/** A finished setup: the secret is in memory only, and shown once. */
export type ServerSetup = {
  product: ServerProduct
  projectId: string
  instanceId: string
  credential: string
  expiresAt: string
}

export type OwnAgentAttachment = {
  projectId: string
  projectTitle: string
  projectState: string
  trackAgents: boolean
  rateHourCents: number
}

export type OwnAgentRow = {
  id: string
  name: string
  product: string
  attachments: OwnAgentAttachment[]
}
