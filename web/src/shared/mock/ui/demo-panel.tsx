/**
 * The demo panel: a "Demo" pill in the bottom-left corner that expands into
 * who you are, what data there is, the network, scenarios and a reset
 * (docs/demo-mode.md). A developer tool, so English only.
 *
 * A change of role, world, profile or plan reloads the page: the database is
 * built for those, and a reload is the one way every store starts clean.
 * Network settings apply to the next request without a reload.
 */
import { useState } from 'react'
import styled from 'styled-components'

import { DEMO_SCENARIOS } from '../scenarios'
import { signInDemo, signOutDemo } from '../session'
import {
  DEMO_ROLES,
  DEMO_WORLDS,
  readDemoSettings,
  writeDemoSettings,
  type DemoNetwork,
  type DemoSettings,
} from '../settings'
import { demoDb, resetDemoData } from '../store'

import type { ReactNode } from 'react'

const ROLE_LABELS: Record<DemoSettings['role'], string> = {
  owner: 'Owner',
  worker: 'Worker',
  viewer: 'Viewer',
  mixed: 'Mixed',
}

const WORLD_LABELS: Record<DemoSettings['world'], [string, string]> = {
  empty: ['Empty', 'No projects, no time'],
  starter: ['Starter', '1 project, a few entries'],
  typical: ['Typical', '3-5 projects, a few weeks'],
  busy: ['Busy', 'Dozens of projects, months, 25 workers'],
  random: ['Random', 'A typical shape, redrawn'],
}

const OPEN_KEY = 'wa.demo.panel-open'

const readOpen = () => {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Saves the choice, signs in as it and starts the demo over. */
const restart = (patch: Partial<DemoSettings>) => {
  writeDemoSettings(patch)
  signInDemo()
  window.location.reload()
}

export const DemoPanel = () => {
  const [open, setOpen] = useState(readOpen)
  const [settings, setSettings] = useState(readDemoSettings)
  const [note, setNote] = useState<{
    tone: 'info' | 'danger'
    text: string
  } | null>(null)

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      sessionStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {
      // The panel just starts closed next time.
    }
  }

  const setNetwork = (patch: Partial<DemoNetwork>) =>
    setSettings(
      writeDemoSettings({ network: { ...settings.network, ...patch } }),
    )

  const runScenario = (id: string) => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === id)
    if (!scenario) {
      return
    }
    try {
      const result = scenario.run()
      setNote({ tone: 'info', text: `${result.note} Opening it…` })
      window.setTimeout(() => window.location.assign(result.path), 900)
    } catch (error) {
      setNote({
        tone: 'danger',
        text: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const db = demoDb()
  const me = db.users.find((user) => user.id === db.meId)

  return (
    <Root aria-label="Demo controls">
      {open && (
        <Panel>
          <Head>
            <strong>Demo mode</strong>
            <span>
              {settings.signedOut
                ? 'Signed out'
                : `Signed in as ${me?.name || me?.address.slice(0, 10) || 'you'}`}
            </span>
          </Head>
          <Section title="Role">
            <Segmented
              value={settings.role}
              options={DEMO_ROLES.map((role) => [role, ROLE_LABELS[role]])}
              onChange={(role) => restart({ role })}
            />
          </Section>
          <Section title="Data">
            <List>
              {DEMO_WORLDS.map((world) => (
                <Choice
                  key={world}
                  type="button"
                  data-active={settings.world === world || undefined}
                  onClick={() => restart({ world })}
                >
                  <b>{WORLD_LABELS[world][0]}</b>
                  <small>{WORLD_LABELS[world][1]}</small>
                </Choice>
              ))}
            </List>
            {settings.world === 'random' && (
              <Action
                type="button"
                onClick={() =>
                  restart({ seed: Math.floor(Math.random() * 1e9) })
                }
              >
                Shuffle
              </Action>
            )}
          </Section>
          <Section title="Profile">
            <Segmented
              value={settings.profile}
              options={[
                ['fresh', 'Fresh'],
                ['finished', 'Finished'],
              ]}
              onChange={(profile) => restart({ profile })}
            />
          </Section>
          <Section title="Plan">
            <Segmented
              value={settings.plan}
              options={[
                ['premium', 'Premium'],
                ['free', 'Free'],
              ]}
              onChange={(plan) => restart({ plan })}
            />
          </Section>
          <Section title="Network">
            <Segmented
              value={settings.network.speed}
              options={[
                ['instant', 'Instant'],
                ['fast', 'Fast'],
                ['slow', 'Slow'],
              ]}
              onChange={(speed) => setNetwork({ speed })}
            />
            <Segmented
              value={settings.network.failure}
              options={[
                ['none', 'Working'],
                ['all', 'Every request fails'],
              ]}
              onChange={(failure) => setNetwork({ failure })}
            />
            <Action
              type="button"
              data-active={settings.network.failNext || undefined}
              onClick={() =>
                setNetwork({ failNext: !settings.network.failNext })
              }
            >
              {settings.network.failNext
                ? 'Next request will fail'
                : 'Fail the next request'}
            </Action>
          </Section>
          <Section title="Scenarios">
            <List>
              {DEMO_SCENARIOS.map((scenario) => (
                <Choice
                  key={scenario.id}
                  type="button"
                  disabled={settings.signedOut}
                  onClick={() => runScenario(scenario.id)}
                >
                  <b>{scenario.label}</b>
                  <small>{scenario.description}</small>
                </Choice>
              ))}
            </List>
            {note && <Note data-tone={note.tone}>{note.text}</Note>}
          </Section>
          <Section title="Demo data">
            <Row>
              <Action
                type="button"
                onClick={() => {
                  resetDemoData()
                  window.location.reload()
                }}
              >
                Reset demo data
              </Action>
              <Action
                type="button"
                onClick={() => {
                  if (settings.signedOut) {
                    signInDemo()
                    window.location.reload()
                  } else {
                    signOutDemo()
                    window.location.assign('/sign-in')
                  }
                }}
              >
                {settings.signedOut ? 'Sign in' : 'Sign out'}
              </Action>
            </Row>
          </Section>
        </Panel>
      )}
      <Pill type="button" aria-expanded={open} onClick={toggle}>
        <Dot data-failing={settings.network.failure === 'all' || undefined} />
        Demo · {ROLE_LABELS[settings.role]} · {WORLD_LABELS[settings.world][0]}
      </Pill>
    </Root>
  )
}

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <SectionRoot>
    <SectionTitle>{title}</SectionTitle>
    {children}
  </SectionRoot>
)

const Segmented = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) => (
  <SegmentedRoot role="radiogroup">
    {options.map(([option, label]) => (
      <button
        key={option}
        type="button"
        role="radio"
        aria-checked={value === option}
        data-active={value === option || undefined}
        onClick={() => value !== option && onChange(option)}
      >
        {label}
      </button>
    ))}
  </SegmentedRoot>
)

/* Bottom left, clear of the toasts (top centre); above the app and its
   dialogs so the demo can be steered with one open. */
const Root = styled.div`
  position: fixed;
  left: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 13px;
  color: #0f172a;
`

const Pill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1baf7a;

  &[data-failing] {
    background: #e34948;
  }
`

const Panel = styled.div`
  display: grid;
  gap: 14px;
  width: min(340px, calc(100vw - 24px));
  max-height: min(78vh, 720px);
  overflow-y: auto;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
`

const Head = styled.div`
  display: grid;
  gap: 2px;

  span {
    color: #52514e;
    font-size: 12px;
  }
`

const SectionRoot = styled.section`
  display: grid;
  gap: 6px;
`

const SectionTitle = styled.h3`
  margin: 0;
  color: #52514e;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`

const SegmentedRoot = styled.div`
  display: flex;
  padding: 2px;
  border-radius: 9px;
  background: #f1f1ef;

  button {
    flex: 1;
    padding: 5px 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #52514e;
    font: inherit;
    cursor: pointer;
  }

  button[data-active] {
    background: #fff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.14);
    color: #0f172a;
    font-weight: 600;
  }
`

const List = styled.div`
  display: grid;
  gap: 4px;
`

const Choice = styled.button`
  display: grid;
  gap: 1px;
  padding: 7px 10px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 9px;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  small {
    color: #52514e;
    font-size: 12px;
  }

  &[data-active] {
    border-color: #2a78d6;
    box-shadow: inset 0 0 0 1px #2a78d6;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

const Row = styled.div`
  display: flex;
  gap: 6px;
`

const Action = styled.button`
  padding: 6px 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 8px;
  background: #fff;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &[data-active] {
    border-color: #e34948;
    color: #b42318;
  }
`

const Note = styled.p`
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #eef5fd;
  font-size: 12px;

  &[data-tone='danger'] {
    background: #fdeeee;
    color: #b42318;
  }
`
