import './app.css'
import '@radix-ui/themes/styles.css'
import { useUnit } from 'effector-react'
import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import {
  initAuth,
  subscribeEthEventsFx,
  subscribeTonUiEventsFx,
} from '@/entities/profile'
import * as Layouts from '@/layouts'
import { routes } from '@/routes'
import { ErrorBoundary } from '@/shared'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const ProfileEditPage = lazy(() => import('@/pages/profile/edit'))
const SignInPage = lazy(() => import('@/pages/sign-in'))
const InvoicePage = lazy(() => import('@/pages/invoice'))
const BalancePage = lazy(() => import('@/pages/balance'))

const router = createBrowserRouter([
  {
    element: <Layouts.AuthLayout />,
    children: [{ path: routes.signIn.schema, element: <SignInPage /> }],
    errorElement: <ErrorBoundary />,
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
        path: routes.profile.schema,
        element: <ProfilePage />,
      },
      {
        path: routes.profile.children.edit.schema,
        element: <ProfileEditPage />,
      },
      {
        path: routes.invoice.schema,
        element: <InvoicePage />,
      },
      {
        path: routes.balance.schema,
        element: <BalancePage />,
      },
    ],
  },
])

export const App = () => {
  const initAuthEvent = useUnit(initAuth)

  const subEthFx = useUnit(subscribeEthEventsFx)
  const subTonFx = useUnit(subscribeTonUiEventsFx)

  useEffect(() => {
    initAuthEvent()

    let unsubEth: (() => void) | null = null
    let unsubTon: (() => void) | null = null

    void subEthFx().then((sub) => {
      unsubEth = sub
    })

    void subTonFx().then((sub) => {
      unsubTon = sub
    })

    return () => {
      unsubEth?.()
      unsubTon?.()
    }
  }, [initAuthEvent, subEthFx, subTonFx])

  return (
    <Suspense>
      <RouterProvider router={router} />
    </Suspense>
  )
}
