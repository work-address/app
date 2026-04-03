import './app.css'
import '@radix-ui/themes/styles.css'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { router } from '@/features/shared'
import * as Layouts from '@/layouts'

const DashboardPage = lazy(() => import('../pages/dashboard-page.tsx'))
const ProfilePage = lazy(() => import('../pages/profile-page.tsx'))
const SignInPage = lazy(() => import('../pages/sign-in-page.tsx'))

function App() {
  return (
    <Suspense fallback={<> Loading... </>}>
      <Routes>
        <Route element={<Layouts.AuthLayout />}>
          <Route path={router.signIn.schema} element={<SignInPage />} />
        </Route>

        <Route element={<Layouts.MainLayout />}>
          <Route path={router.dashboard.schema} element={<DashboardPage />} />
          <Route path={router.profile.schema} element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
