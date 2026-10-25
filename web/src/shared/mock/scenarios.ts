/**
 * Demo scenarios: buttons in the panel that make something happen as if
 * another person or the desktop app did it. Each writes to the demo database
 * - so the next read shows it - and says what happened and where to look.
 */

import { isOwner, isWorker, projectOf, visibleProjects } from './shape'
import { demoDb, saveRow } from './store'

import type { MockRun, MockTime } from './db'

import { routes } from '@/routes'

export type DemoScenarioResult = { note: string; path: string }

export type DemoScenario = {
  id: string
  label: string
  description: string
  run: () => DemoScenarioResult
}

const SLOT_MS = 10 * 60_000

const unavailable = (why: string): never => {
  throw new Error(why)
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'time.upload',
    label: 'A worker uploads time now',
    description:
      'Half an hour from the desktop app, still inside its review window',
    run: () => {
      const db = demoDb()
      const project = visibleProjects(db, db.meId).find((p) =>
        p.workerIds.some((id) => id !== db.meId),
      )
      if (!project) {
        unavailable(
          'No project here has another worker. Pick a world with a team.',
        )
      }
      const userId = project!.workerIds.find((id) => id !== db.meId)!
      const end = Math.floor(Date.now() / SLOT_MS) * SLOT_MS
      for (let slot = 3; slot > 0; slot--) {
        const from = end - slot * SLOT_MS
        saveRow<MockTime>('times', {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectId: project!.id,
          userId,
          fromAt: new Date(from).toISOString(),
          toAt: new Date(from + SLOT_MS).toISOString(),
          isPaid: false,
          note: 'Uploaded by the demo just now',
          screenshot: project!.trackScreenshots ? slot % 6 : null,
          appsStatus: project!.trackProcesses ? 'ok' : 'off',
          apps: project!.trackProcesses ? [{ name: 'Code', seconds: 360 }] : [],
          source: 'desktop',
          publishedAt: null,
          minutesActive: 7,
          keyboardKeys: 420,
          mouseKeys: 90,
          mouseDistance: 2200,
          invoiceId: null,
        })
      }
      return {
        note: `30 minutes arrived on ${project!.title}. An owner sees the time now and the detail after review.`,
        path: routes.time.build(),
      }
    },
  },
  {
    id: 'agent.finish',
    label: 'An agent run finishes',
    description: 'A 40-minute run with its prompt, ending now',
    run: () => {
      const db = demoDb()
      const project = db.projects.find(
        (p) => !p.deletedAt && p.trackAgents && isWorker(db, p, db.meId),
      )
      if (!project) {
        unavailable('You do not work on a project that tracks agents.')
      }
      const userId = isOwner(project!, db.meId)
        ? (project!.workerIds[0] ?? db.meId)
        : db.meId
      const end = Date.now()
      const start = end - 40 * 60_000
      saveRow<MockRun>('runs', {
        runKey: crypto.randomUUID().replaceAll('-', ''),
        userId,
        projectId: project!.id,
        agentId: crypto.randomUUID(),
        product: 'claude-code',
        surface: 'cli',
        fromAt: new Date(start).toISOString(),
        toAt: new Date(end).toISOString(),
        status: 'completed',
        segments: [
          {
            state: 'running',
            fromAt: new Date(start).toISOString(),
            toAt: new Date(end).toISOString(),
            evidence: 'demo',
          },
        ],
        prompt: 'Summarise what changed in the demo since this morning',
        invoiceId: null,
        isPaid: false,
      })
      return {
        note: `A claude-code run finished on ${project!.title}.`,
        path: routes.dashboard.build(),
      }
    },
  },
  {
    id: 'invoice.paid',
    label: 'The owner marks an invoice paid',
    description: 'The oldest requested invoice becomes paid',
    run: () => {
      const db = demoDb()
      const invoice = db.invoices
        .filter((i) => i.state === 'Requested')
        .filter((i) => {
          const project = db.projects.find((p) => p.id === i.projectId)
          return i.userId === db.meId || (project && isOwner(project, db.meId))
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      if (!invoice) {
        unavailable('There is no requested invoice to pay.')
      }
      const now = new Date().toISOString()
      saveRow('invoices', {
        ...invoice!,
        state: 'PAID',
        paidAt: now,
        updatedAt: now,
      })
      for (const time of db.times.filter((t) =>
        invoice!.timeIds.includes(t.id),
      )) {
        saveRow('times', { ...time, isPaid: true })
      }
      return {
        note: `Invoice for ${projectOf(db, invoice!.projectId)?.title ?? 'a project'} is paid.`,
        path: routes.invoice.build({ id: invoice!.id }),
      }
    },
  },
  {
    id: 'review.pass',
    label: 'A review window passes',
    description: 'Every held screenshot, app list and prompt reaches the owner',
    run: () => {
      const db = demoDb()
      const now = Date.now()
      let released = 0
      for (const time of db.times) {
        const project = projectOf(db, time.projectId)
        if (!project || time.publishedAt || time.invoiceId) {
          continue
        }
        if (
          Date.parse(time.toAt) + project.reviewWindowHours * 3_600_000 >
          now
        ) {
          saveRow('times', {
            ...time,
            publishedAt: new Date(now).toISOString(),
          })
          released++
        }
      }
      for (const run of db.runs.filter((r) => !r.released)) {
        saveRow('runs', { ...run, released: true })
      }
      return {
        note: released
          ? `${released} entries were published, with their prompts.`
          : 'Nothing was waiting for review.',
        path: routes.dashboard.build(),
      }
    },
  },
]
