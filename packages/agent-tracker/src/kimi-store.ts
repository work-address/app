import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  captureKimiEnd,
  kimiOpenTurns,
  type CaptureOptions,
  type KimiOpenTurn,
} from './adapters.js'
import type { CollectorConfig } from './config.js'
import type { EventQueue } from './queue.js'

/*
 * Kimi Code keeps each session's history in
 * ~/.kimi-code/sessions/<workdir>/<session>/agents/main/wire.jsonl, where
 * `turn.ended` gives a turn's turnId, reason (completed, failed, cancelled)
 * and time. Kimi Code 2.x fires no hook at a normal turn end, so the open
 * turns are closed from there: on the next Kimi hook and on every sync.
 */

const MAX_WIRE_BYTES = 64 * 1024 * 1024
const GIVE_UP_MS = 7 * 86_400_000

export function kimiHome(): string {
  return process.env.WORK_ADDRESS_KIMI_HOME ?? join(homedir(), '.kimi-code')
}

function wireOf(home: string, session: string): string | undefined {
  const sessions = join(home, 'sessions')
  if (!existsSync(sessions)) return
  for (const workdir of readdirSync(sessions)) {
    const wire = join(
      sessions,
      workdir,
      session,
      'agents',
      'main',
      'wire.jsonl',
    )
    if (existsSync(wire)) return wire
  }
}

/** How the store says the turn ended, or nothing while it runs. */
export function kimiTurnEnd(
  home: string,
  open: KimiOpenTurn,
): { reason: string; at: number } | undefined {
  const wire = wireOf(home, open.session)
  if (!wire || statSync(wire).size > MAX_WIRE_BYTES) return
  for (const line of readFileSync(wire, 'utf8').split('\n')) {
    if (!line.includes('"turn.ended"')) continue
    try {
      const entry = JSON.parse(line)
      if (
        entry.type === 'turn.ended' &&
        String(entry.turnId) === String(open.turn) &&
        (entry.agentId === undefined || entry.agentId === 'main')
      )
        return {
          reason: String(entry.reason),
          at: Number.isFinite(entry.time) ? entry.time : Date.now(),
        }
    } catch {
      // A torn last line while Kimi writes; the next pass reads it whole.
    }
  }
}

/** Closes the Kimi turns whose end the store has; returns the events queued. */
export function reconcileKimi(
  queue: EventQueue,
  config: CollectorConfig,
  options: CaptureOptions,
  home: string = kimiHome(),
): number {
  const now = Date.now()
  const ended = new Map<KimiOpenTurn, { reason: string; at: number }>()
  const open = kimiOpenTurns(queue, (turn) => {
    const end = kimiTurnEnd(home, turn)
    if (end) ended.set(turn, end)
    return !end && now - turn.at < GIVE_UP_MS
  })
  let count = 0
  for (const turn of open) {
    const end = ended.get(turn)
    if (end)
      count += captureKimiEnd(queue, config, turn, end.reason, end.at, options)
  }
  return count
}
