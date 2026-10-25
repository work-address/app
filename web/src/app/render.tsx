import { Theme } from '@radix-ui/themes'
import { attachLogger } from 'effector-logger'
import { MotionConfig } from 'motion/react'
import { Fragment, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'styled-components'

import { App } from './app'

import { AuthSolanaWalletMount } from '@/features/auth'
import {
  ToastStyle,
  theme,
  Confirm,
  BreakpointsWatcher,
  SonnerRadixTheme,
} from '@/shared'
import '@/shared/i18n'

const REACT_STRICT_MODE = false

const AppWrapper = REACT_STRICT_MODE ? StrictMode : Fragment

/** Mounts the app. Loaded by `main.tsx` once the demo, if any, is running. */
export const render = (root: HTMLElement) =>
  createRoot(root).render(
    <AppWrapper>
      <MotionConfig reducedMotion="user">
        <AuthSolanaWalletMount />
        <Theme>
          <ThemeProvider theme={theme}>
            <Confirm />
            <BreakpointsWatcher />
            <ToastStyle />
            <HelmetProvider>
              <App />
            </HelmetProvider>
          </ThemeProvider>
        </Theme>
        <SonnerRadixTheme>
          <Toaster />
        </SonnerRadixTheme>
      </MotionConfig>
    </AppWrapper>,
  )

if (import.meta.env.DEV && localStorage.getItem('log') === '1') {
  attachLogger()
}
