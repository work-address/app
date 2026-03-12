import './app.css'
import Header from './components/header'
import Dashboard from './pages/dashboard'
import SignIn from './pages/sign-in'
import Profile from './pages/profile'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  return <SignIn onSignIn={() => navigate('/dashboard')} />
}

export default App
