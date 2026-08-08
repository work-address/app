import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'

import SignInPageView from '@/pages/sign-in'
import { theme } from '@/shared'

export const SignInPage = () => {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path={'*'} element={<SignInPageView />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
