import { Theme } from '@radix-ui/themes'
import { attachLogger } from 'effector-logger'
import { MotionConfig } from 'motion/react'
import { Fragment, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'styled-components'

import { App } from './app/app'

import { AuthSolanaWalletMount } from '@/features/auth'
import {
  ToastStyle,
  theme,
  Confirm,
  BreakpointsWatcher,
  SonnerRadixTheme,
} from '@/shared'
import '@/shared/i18n'

const ROOT_ELEMENT_ID = 'root'
const REACT_STRICT_MODE = false

const ROOT_ELEMENT = document.getElementById(ROOT_ELEMENT_ID)

if (ROOT_ELEMENT === null) {
  throw new Error(
    `No root element in the dom tree. Check if element with id "${ROOT_ELEMENT_ID}" exists`,
  )
}

const AppWrapper = REACT_STRICT_MODE ? StrictMode : Fragment

createRoot(ROOT_ELEMENT).render(
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
