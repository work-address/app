import { Theme } from '@radix-ui/themes'
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { HeaderUserLink } from './header-user-link'

import '@radix-ui/themes/styles.css'
import '@/app/app.css'
import i18n from '@/shared/i18n/i18n'
import { theme } from '@/shared/lib/theme'

/**
 * A self-hosted instance has no plan to sell, so the header must not carry a
 * plan at all: not the star, and not a 'No premium' pill that opens an
 * upgrade banner for a hosted service the instance does not use. Rendered for
 * real because the rule is only worth anything once the component obeys it.
 */
const WALLET = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

let host: HTMLDivElement
let root: Root

const render = (user: { premium: boolean; billing?: boolean }) =>
  act(() =>
    root.render(
      <StrictMode>
        <Theme>
          <ThemeProvider theme={theme}>
            <MemoryRouter>
              <HeaderUserLink
                user={{ name: 'Ada', friendlyWalletAddress: WALLET, ...user }}
                userAlt="Profile"
                onNoPremiumClick={() => {}}
              />
            </MemoryRouter>
          </ThemeProvider>
        </Theme>
      </StrictMode>,
    ),
  )

const premiumStar = () =>
  host.querySelector(`[role="img"][aria-label="${i18n.t('common.premium')}"]`)

const noPremiumPill = () =>
  [...host.querySelectorAll('button, span')].find(
    (element) => element.textContent === i18n.t('common.noPremium'),
  ) ?? null

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('the header account link', () => {
  it.each([true, false])(
    'shows no plan on a self-hosted instance (premium: %s)',
    (premium) => {
      render({ premium, billing: false })

      expect(host.textContent).toContain('Ada')
      expect(premiumStar()).toBeNull()
      expect(noPremiumPill()).toBeNull()
    },
  )

  it('shows the star for a premium account where billing applies', () => {
    render({ premium: true, billing: true })

    expect(premiumStar()).not.toBeNull()
    expect(noPremiumPill()).toBeNull()
  })

  it('shows the No premium pill for a free account where billing applies', () => {
    render({ premium: false, billing: true })

    expect(noPremiumPill()).not.toBeNull()
    expect(premiumStar()).toBeNull()
  })
})
