import './app.css'
import '@radix-ui/themes/styles.css'
import { useUnit } from 'effector-react'
import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { authModel } from '@/features/auth'
import { routes } from '@/features/shared'
import * as Layouts from '@/layouts'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const ProfileEditPage = lazy(() => import('@/pages/profile/edit'))
const SignInPage = lazy(() => import('@/pages/sign-in'))
const InvoicePage = lazy(() => import('@/pages/invoice'))

const router = createBrowserRouter([
  {
    element: <Layouts.AuthLayout />,
    children: [{ path: routes.signIn.schema, element: <SignInPage /> }],
  },
  {
    element: <Layouts.MainLayout />,
    children: [
      { path: routes.dashboard.schema, element: <DashboardPage /> },
      { path: routes.profile.schema, element: <ProfilePage /> },
      {
        path: routes.profile.children.edit.schema,
        element: <ProfileEditPage />,
      },
      { path: routes.invoice.schema, element: <InvoicePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/sign-in" replace /> },
])

export const App = () => {
  const initAuthEvent = useUnit(authModel.initAuth)

  useEffect(() => {
    initAuthEvent()
  }, [initAuthEvent])

  return (
    <Suspense>
      <RouterProvider router={router} />
    </Suspense>
  )
}
