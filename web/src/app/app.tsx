import './app.css'
import '@radix-ui/themes/styles.css'
import { useUnit } from 'effector-react'
import { lazy, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { initAuth } from '@/entities/profile'
import * as Layouts from '@/layouts'
import { routes } from '@/routes'
import { bindNavigate, ErrorBoundary } from '@/shared'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const ProfileEditPage = lazy(() => import('@/pages/profile-edit'))
const SignInPage = lazy(() => import('@/pages/sign-in'))
const ConnectPage = lazy(() => import('@/pages/connect'))
const InvoicePage = lazy(() => import('@/pages/invoice'))
const InvoicesPage = lazy(() => import('@/pages/invoices'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

const router = createBrowserRouter([
  {
    element: <Layouts.AuthLayout />,
    children: [
      { path: routes.signIn.schema, element: <SignInPage /> },
      { path: routes.connect.schema, element: <ConnectPage /> },
    ],
    errorElement: <ErrorBoundary />,
  },
  {
    element: <Layouts.PublicLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: routes.profile.schema,
        element: <ProfilePage />,
      },
      {
        // Anything unknown, signed in or not. It renders inside the shell so
        // the navigation is still there; MainLayout would bounce a guest to
        // sign-in before they learned the link was wrong.
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    element: <Layouts.MainLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: routes.dashboard.schema,
        element: <DashboardPage />,
      },
      {
        path: routes.profile.children.edit.schema,
        element: <ProfileEditPage />,
      },
      {
        path: routes.invoices.schema,
        element: <InvoicesPage />,
      },
      {
        path: routes.invoice.schema,
        element: <InvoicePage />,
      },
      {
        // The list moved from /invoices to /invoice; keep old links working.
        path: '/invoices',
        element: <Navigate to={routes.invoices.build()} replace />,
      },
      {
        // There is no download page in the app; links to it have always
        // landed on the dashboard, and the catch-all must not change that.
        path: routes.download.schema,
        element: <Navigate to={routes.dashboard.build()} replace />,
      },
    ],
  },
])

// The router is a module singleton, so navigation does not need the React
// tree - models can route through navigateFx as the target of a sample.
bindNavigate(({ to, options }) => router.navigate(to, options))

export const App = () => {
  const initAuthEvent = useUnit(initAuth)

  useEffect(() => {
    initAuthEvent()
  }, [initAuthEvent])

  return <RouterProvider router={router} />
}
