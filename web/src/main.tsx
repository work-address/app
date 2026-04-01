import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'

import App from './app'

import { theme } from '@/lib/theme'

const rootElementId = 'root'
const rootElement = document.getElementById(rootElementId)

if (rootElement === null) {
  throw new Error(
    `No root element in the dom tree. Check if element with "${rootElementId}" id exists`,
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
