import './app.css'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { Header } from '@/widgets'

const DashboardPage = lazy(() => import('../pages/dashboard-page.tsx'))
const ProfilePage = lazy(() => import('../pages/profile-page.tsx'))
const SignInPage = lazy(() => import('../pages/sign-in-page.tsx'))

function App() {
  return (
    <Suspense fallback={<> Loading... </>}>
      <Routes>
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/" element={<DashboardLayout />} />
        <Route path="/dashboard" element={<DashboardLayout />} />
        <Route path="/profile" element={<ProfileLayout />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </Suspense>
  )
}

function DashboardLayout() {
  return (
    <div>
      <Header active="dashboard" />
      <DashboardPage />
    </div>
  )
}

function ProfileLayout() {
  return (
    <div>
      <Header active="profile" />
      <ProfilePage />
    </div>
  )
}

function SignInRoute() {
  return <SignInPage />
}

export default App
