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
}

export type ServerCredentialState = 'active' | 'expiring' | 'expired'

export type ServerCredentialRow = {
  id: string
  label: string
  prefix: string
  expiresAt: string
  lastUsedAt: string | null
  state: ServerCredentialState
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
