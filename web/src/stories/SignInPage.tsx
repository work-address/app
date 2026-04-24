import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'

import Work AddressSignInPage from '@/pages/sign-in.tsx'
import { theme } from '@/shared'

export const SignInPage = () => {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path={'*'} element={<Work AddressSignInPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
