import { Theme } from '@radix-ui/themes'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  loadIdentityConfigFx,
  publishIdentityFx,
  withdrawIdentityFx,
} from '../../model'

import { IdentityCardWalletDialog } from './identity-card-wallet-dialog'

import type { IdentityConfig } from '../../model'

import '@radix-ui/themes/styles.css'
import '@/app/app.css'
import '@/shared/i18n/i18n'
import { theme } from '@/shared/lib/theme'

const RELAY_LABEL = 'Let this site pay the network fee'

const CONFIG: IdentityConfig = {
  enabled: true,
  chainId: 31_337,
  registryAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  manifestUrl: null,
  schemaIds: [1],
  relayEnabled: true,
}

type Sent = { password: string; relay?: boolean }

let host: HTMLDivElement
let root: Root
let sent: { publish: Sent[]; withdraw: Sent[] }

/** Puts `config` in the store the dialog reads, as a GET /identity/config would. */
const configure = async (config: IdentityConfig) => {
  loadIdentityConfigFx.use(async () => config)
  await act(async () => {
    await loadIdentityConfigFx()
  })
}

const open = (action: 'publish' | 'withdraw') =>
  act(() =>
    root.render(
      <Theme>
        <ThemeProvider theme={theme}>
          <IdentityCardWalletDialog action={action} onOpenChange={() => {}} />
        </ThemeProvider>
      </Theme>,
    ),
  )

const relayOption = (): HTMLElement | null =>
  [...document.querySelectorAll('label')].find(
    (label) => label.textContent === RELAY_LABEL,
  ) ?? null

/** Types the password and submits, as the holder would. */
const submit = async () => {
  const input = document.querySelector<HTMLInputElement>(
    '#identity-wallet-password',
  )

  if (!input) {
    throw new Error('The password field is not rendered')
  }

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set

    setter?.call(input, 'correct horse battery')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    input.form?.requestSubmit()
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

beforeEach(() => {
  sent = { publish: [], withdraw: [] }
  publishIdentityFx.use(async (params) => {
    sent.publish.push(params)

    return {} as never
  })
  withdrawIdentityFx.use(async (params) => {
    sent.withdraw.push(params)
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

/**
 * WP-122 in the dashboard: the gasless path is offered only when the API
 * says a relayer runs, is the default there (the browser's own wallet holds
 * no ETH), and the direct transaction is one click away - and the only
 * thing on offer when the relayer is off.
 */
describe('the wallet dialog', () => {
  it('offers the relay when the API runs one, and relays by default', async () => {
    await configure(CONFIG)
    open('publish')

    expect(relayOption()).not.toBeNull()

    await submit()

    expect(sent.publish).toEqual([
      { password: 'correct horse battery', relay: true },
    ])
  })

  it('sends from the wallet itself once the holder unticks the relay', async () => {
    await configure(CONFIG)
    open('withdraw')

    const checkbox = document.querySelector<HTMLElement>(
      '#identity-wallet-relay',
    )

    await act(async () => {
      checkbox?.click()
    })
    await submit()

    expect(sent.withdraw).toEqual([
      { password: 'correct horse battery', relay: false },
    ])
  })

  it('offers only the direct transaction when no relayer runs', async () => {
    await configure({ ...CONFIG, relayEnabled: false })
    open('publish')

    expect(relayOption()).toBeNull()

    await submit()

    expect(sent.publish).toEqual([
      { password: 'correct horse battery', relay: false },
    ])
  })
})
