import './app.css'
import { Navigate, Route, Routes } from 'react-router-dom'

import DashboardPage from '../pages/dashboard-page.tsx'
import ProfilePage from '../pages/profile-page.tsx'
import SignInPage from '../pages/sign-in-page.tsx'
import Header from '../widgets/header.tsx'

function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInRoute />} />
      <Route path="/" element={<DashboardLayout />} />
      <Route path="/dashboard" element={<DashboardLayout />} />
      <Route path="/profile" element={<ProfileLayout />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
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
