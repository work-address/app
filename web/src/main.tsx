import { Theme } from '@radix-ui/themes'
import { attachLogger } from 'effector-logger'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'styled-components'
import '@/shared/i18n/i18n'

import { App } from './app/app'

import {
  ToastStyle,
  theme,
  Confirm,
  BreakpointsWatcher,
  SonnerRadixTheme,
} from '@/features/shared'

const rootElementId = 'root'
const rootElement = document.getElementById(rootElementId)

if (rootElement === null) {
  throw new Error(
    `No root element in the dom tree. Check if element with id "${rootElementId}" exists`,
  )
}

createRoot(rootElement).render(
  <StrictMode>
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
  </StrictMode>,
)

if (import.meta.env.DEV) {
  attachLogger()
}
