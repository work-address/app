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
  product: string
  removedAt: string | null
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
