/**
 * The Team page, as `TeamManager` answers it. The demo has no agent list, so an
 * agent here is a product a person's runs used: its id is `userId:product`.
 */
import { isOwner, isWorker, projectOf, userOf, visibleProjects } from './shape'

import type { Db, MockProject } from './db'

/** Agents set up by hand are attached where they have a rate. */
const createdOn = (db: Db, project: MockProject, userId: string) =>
  db.agents
    .filter(
      (agent) =>
        agent.userId === userId &&
        !agent.removedAt &&
        project.agentRates?.[agent.id] !== undefined,
    )
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      product: agent.product,
      rateHourCents: project.agentRates![agent.id],
      attachedAt: agent.createdAt,
      lastRateChange: null,
    }))

const agentsOn = (db: Db, project: MockProject, userId: string) => [
  ...[
    ...new Set(
      db.runs
        .filter((run) => run.projectId === project.id && run.userId === userId)
        .map((run) => run.product),
    ),
  ].map((product) => {
    const id = `${userId}:${product}`

    return {
      id,
      name: product,
      product,
      rateHourCents: project.agentRates?.[id] ?? 0,
      attachedAt: project.createdAt,
      lastRateChange: null,
    }
  }),
  ...createdOn(db, project, userId),
]

export function teamOf(db: Db, meId: string) {
  const visible = visibleProjects(db, meId)
  const worked = visible.filter((project) => isWorker(db, project, meId))

  const person = (
    project: MockProject,
    userId: string,
    role: 'owner' | 'worker' | 'viewer',
  ) => {
    const user = userOf(db, userId)

    return {
      address: user?.address ?? userId,
      // `idsForAddresses` makes a nameless user for an address nobody has signed
      // in with, where the API has no account at all.
      userId: user?.name ? userId : null,
      name: user?.name || null,
      role,
      agents:
        role !== 'viewer' && (isOwner(project, meId) || userId === meId)
          ? agentsOn(db, project, userId)
          : [],
    }
  }

  return {
    viewerOnly: worked.length === 0 && visible.length > 0,
    projects: worked.map((project) => ({
      id: project.id,
      title: project.title,
      state: project.state,
      role: isOwner(project, meId) ? 'owner' : 'worker',
      trackAgents: project.trackAgents,
      people: [
        person(project, project.ownerId, 'owner'),
        ...project.workerIds.map((id) => person(project, id, 'worker')),
        ...project.viewerIds.map((id) => person(project, id, 'viewer')),
      ],
    })),
  }
}

export const ownAgents = (db: Db, meId: string) => {
  const products = new Set(
    db.runs
      .filter((run) => run.userId === meId && projectOf(db, run.projectId))
      .map((run) => run.product),
  )

  return [
    ...[...products].map((product) => ({
      id: `${meId}:${product}`,
      name: product,
      slug: product,
      product,
      removedAt: null,
    })),
    ...db.agents
      .filter((agent) => agent.userId === meId)
      .map(({ id, name, slug, product, removedAt }) => ({
        id,
        name,
        slug,
        product,
        removedAt,
      })),
  ]
}
