import { Theme } from '@radix-ui/themes'
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { identityPreview } from '../../model/identity-slots'
import { IdentityChip } from '../identity-chip/identity-chip'

import { IdentityCardActions } from './identity-card-actions'
import { IdentityCardHistory } from './identity-card-history'
import { IdentityCardPreview } from './identity-card-preview'

import type { IdentityView } from '../../model/identity-state'
import type { AppPublicUser } from '@/shared/vendor/identity'

import '@radix-ui/themes/styles.css'
import '@/app/app.css'
import '@/shared/i18n/i18n'
import { theme } from '@/shared/lib/theme'

/**
 * The phone width this app is laid out for. The card carries the longest
 * strings in the product - a permanence notice, a custody statement, 66-hex
 * transaction hashes and four buttons - so it is the section most likely to
 * push the profile page sideways.
 */
const PHONE_WIDTH = 375

/** A profile with every schema v1 column filled as long as the schema allows. */
const CROWDED: AppPublicUser = {
  name: 'Grace Brewster Murray Hopper',
  title: 'Rear Admiral, United States Navy (retired)',
  company: 'Eckert–Mauchly Computer Corporation',
  bio: 'Wrote the first compiler, and then spent thirty years explaining why a computer should read something a person can read too.',
  rate: '9999.99',
  skills: 'COBOL,FLOW-MATIC,Compilers,Standards committees,Public speaking',
  city: 'Arlington',
  country: 'US',
  facebook: 'grace.brewster.murray.hopper.official',
  linkedIn: 'grace-brewster-murray-hopper',
  twitter: 'amazing_grace_hopper_nanoseconds',
  instagram: 'grace.hopper.nanoseconds',
  youtube: 'GraceHopperOnNanoseconds',
  telegram: 'grace_hopper_nanoseconds',
}

const HASH = `0x${'ab'.repeat(32)}`

const HISTORY: NonNullable<IdentityView['history']> = [
  {
    kind: 'PUBLISHED',
    version: 1,
    schemaId: 1,
    commitment: HASH,
    at: '2026-01-27T18:40:00.000Z',
    blockNumber: 1024,
    transactionHash: HASH,
    logIndex: 0,
  },
  {
    kind: 'DEACTIVATED',
    version: 1,
    schemaId: null,
    commitment: null,
    at: '2026-02-03T09:15:00.000Z',
    blockNumber: 2048,
    transactionHash: HASH,
    logIndex: 1,
  },
]

let host: HTMLDivElement
let root: Root

const Card = () => (
  <Theme>
    <ThemeProvider theme={theme}>
      <section>
        <IdentityCardPreview preview={identityPreview(CROWDED)} />
        <IdentityCardActions
          hosted
          publishable
          acknowledged
          removing={false}
          onPublish={() => {}}
          onWithdraw={() => {}}
          onRemove={() => {}}
          onExport={() => {}}
        />
        <IdentityCardHistory history={HISTORY} />
        <IdentityChip state="current" version={2} />
      </section>
    </ThemeProvider>
  </Theme>
)

beforeEach(() => {
  document.documentElement.style.overflowX = 'hidden'
  document.body.style.margin = '0'
  host = document.createElement('div')
  // The card is one section of the profile form, which is the page's width on
  // a phone: the measurement below is of the card inside that width, not of a
  // box free to be as wide as it likes.
  host.style.width = `${PHONE_WIDTH}px`
  host.style.overflowX = 'visible'
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('the identity card at 375px', () => {
  beforeEach(() => {
    act(() =>
      root.render(
        <StrictMode>
          <Card />
        </StrictMode>,
      ),
    )
  })

  it('fits the phone it is laid out for, with nothing scrolling sideways', () => {
    expect(host.scrollWidth).toBeLessThanOrEqual(PHONE_WIDTH)
  })

  it.each([
    ['the whole card', () => host.firstElementChild],
    ['the slot preview', () => host.querySelector('dl')],
    ['the history', () => host.querySelector('ol')],
  ])('keeps %s inside its own box', (_label, find) => {
    const element = find() as HTMLElement | null

    expect(element).not.toBeNull()
    expect(element!.scrollWidth).toBeLessThanOrEqual(element!.clientWidth)
  })

  it('wraps the long strings rather than widening the page', () => {
    for (const element of host.querySelectorAll<HTMLElement>('*')) {
      expect(
        element.getBoundingClientRect().right,
        element.tagName,
      ).toBeLessThanOrEqual(PHONE_WIDTH + 1)
    }
  })
})
