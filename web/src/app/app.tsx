import './app.css'
import '@radix-ui/themes/styles.css'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { routes } from '@/features/shared'
import * as Layouts from '@/layouts'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const ProfileCleintPage = lazy(() => import('@/pages/profile/client'))
const SignInPage = lazy(() => import('@/pages/sign-in'))

function App() {
  return (
    <Suspense fallback={<> Loading... </>}>
      <Routes>
        <Route element={<Layouts.AuthLayout />}>
          <Route path={routes.signIn.schema} element={<SignInPage />} />
        </Route>

        <Route element={<Layouts.MainLayout />}>
          <Route path={routes.dashboard.schema} element={<DashboardPage />} />
          <Route path={routes.profile.schema} element={<ProfilePage />} />
          <Route
            path={routes.profile.children.client.schema}
            element={<ProfileCleintPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
