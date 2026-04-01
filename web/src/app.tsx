import './app.css'
import { Navigate, Route, Routes } from 'react-router-dom'

import Header from './components/header'
import Dashboard from './pages/dashboard'
import Profile from './pages/profile'
import SignInPage from './pages/sign-in-page.tsx'

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
      <Dashboard />
    </div>
  )
}

function ProfileLayout() {
  return (
    <div>
      <Header active="profile" />
      <Profile />
    </div>
  )
}

function SignInRoute() {
  return <SignInPage />
}

export default App
