/**
 * What the demo is set to: who you are, how much data there is, and how the
 * network behaves. Kept in localStorage so a reload - which is how a change
 * of role or world takes effect - comes back to the same demo.
 */
export const DEMO_ROLES = ['owner', 'worker', 'viewer', 'mixed'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export const DEMO_WORLDS = [
  'empty',
  'starter',
  'typical',
  'busy',
  'random',
] as const
export type DemoWorldId = (typeof DEMO_WORLDS)[number]

/** What the sign-in screen meets: which ways in, and how Google answers. */
export const DEMO_SIGN_INS = [
  'google',
  'wallet-only',
  'methods-failed',
  'script-failed',
  'google-email-taken',
  'google-email-unverified',
  'google-invalid',
  'google-unavailable',
] as const
export type DemoSignIn = (typeof DEMO_SIGN_INS)[number]

export type DemoNetwork = {
  speed: 'instant' | 'fast' | 'slow'
  failure: 'none' | 'all'
  /** Fail exactly one request, then go back to `failure`. */
  failNext: boolean
}

export type DemoSettings = {
  role: DemoRole
  world: DemoWorldId
  /** What a random world is drawn from; Shuffle picks another. */
  seed: number
  profile: 'fresh' | 'finished'
  plan: 'premium' | 'free'
  signIn: DemoSignIn
  network: DemoNetwork
  /** Set by a demo sign-out, cleared by any sign-in. */
  signedOut: boolean
}

export const DEFAULT_DEMO_SETTINGS: DemoSettings = {
  role: 'owner',
  world: 'typical',
  seed: 0,
  profile: 'finished',
  plan: 'premium',
  signIn: 'google',
  network: { speed: 'fast', failure: 'none', failNext: false },
  signedOut: false,
}

const KEY = 'wa.demo.settings'

const pick = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback)

/** Stored settings, with anything unknown or malformed back at its default. */
export function readDemoSettings(): DemoSettings {
  let saved: Partial<DemoSettings> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    // Storage disabled or corrupt: the defaults are a working demo.
  }
  const d = DEFAULT_DEMO_SETTINGS
  const network = (saved.network ?? {}) as Partial<DemoNetwork>
  return {
    role: pick(saved.role, DEMO_ROLES, d.role),
    world: pick(saved.world, DEMO_WORLDS, d.world),
    seed: Number.isFinite(saved.seed) ? Number(saved.seed) : d.seed,
    profile: pick(saved.profile, ['fresh', 'finished'] as const, d.profile),
    plan: pick(saved.plan, ['premium', 'free'] as const, d.plan),
    signIn: pick(saved.signIn, DEMO_SIGN_INS, d.signIn),
    network: {
      speed: pick(network.speed, ['instant', 'fast', 'slow'] as const, 'fast'),
      failure: pick(network.failure, ['none', 'all'] as const, 'none'),
      failNext: network.failNext === true,
    },
    signedOut: saved.signedOut === true,
  }
}

export function writeDemoSettings(patch: Partial<DemoSettings>): DemoSettings {
  const next = { ...readDemoSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // The demo still runs for this page; the choice is just not kept.
  }
  return next
}

/** The data a role and world are drawn from; edits are kept under it. */
export const demoDataKey = (settings: DemoSettings) =>
  [
    settings.role,
    settings.world,
    settings.world === 'random' ? settings.seed : 0,
    settings.profile,
    settings.plan,
  ].join(':')
