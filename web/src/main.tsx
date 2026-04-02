import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './i18n/i18n'
import App from './app'

import App from './app/app.tsx'

import { ErrorToastStyle, theme } from '@/features/shared'

const rootElementId = 'root'
const rootElement = document.getElementById(rootElementId)

if (rootElement === null) {
  throw new Error(
    `No root element in the dom tree. Check if element with id "${rootElementId}" exists`,
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <Toaster />
      <ErrorToastStyle />

      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
