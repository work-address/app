import './app.css'
import '@radix-ui/themes/styles.css'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { routes } from '@/features/shared'
import * as Layouts from '@/layouts'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const ProfileEditPage = lazy(() => import('@/pages/profile/edit'))
const SignInPage = lazy(() => import('@/pages/sign-in'))
const InvoicePage = lazy(() => import('@/pages/invoice'))

function App() {
  return (
    <Suspense>
      <Routes>
        <Route element={<Layouts.AuthLayout />}>
          <Route path={routes.signIn.schema} element={<SignInPage />} />
        </Route>

        <Route element={<Layouts.MainLayout />}>
          <Route path={routes.dashboard.schema} element={<DashboardPage />} />

          <Route path={routes.profile.schema} element={<ProfilePage />} />

          <Route
            path={routes.profile.children.edit.schema}
            element={<ProfileEditPage />}
          />
          <Route path={routes.invoice.schema} element={<InvoicePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
