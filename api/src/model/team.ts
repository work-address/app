import type { ProjectRole } from '@/service/project-access'

export interface ITeamAgent {
  id: string
  name: string
  product: string
  rateHourCents: number
  attachedAt: string
  /** The newest change, so an owner can see a rate move before it is billed. */
  lastRateChange: { at: string; fromCents: number; toCents: number } | null
}

export interface ITeamPerson {
  /** What the project's list holds, or the owner's own address. */
  address: string
  /** Null until this address has signed in: a list entry needs no account. */
  userId: string | null
  name: string | null
  role: ProjectRole
  agents: ITeamAgent[]
}

export interface ITeamProject {
  id: string
  title: string
  state: string
  /** Never a viewer: a viewer gets no team view of a project. */
  role: 'owner' | 'worker'
  trackAgents: boolean
  people: ITeamPerson[]
}

export interface ITeam {
  /** On some project's lists, and only ever as a viewer: no Team page. */
  viewerOnly: boolean
  projects: ITeamProject[]
}
