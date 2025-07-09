import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { TranscriptCleanerPro } from './pages/TranscriptCleanerPro'
import { PromptEngineeringDashboard } from './pages/PromptEngineeringDashboard'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './lib/auth'

function App() {
  const { isAuthenticated, user, checkAuthStatus, logout } = useAuth()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  console.log('App render - isAuthenticated:', isAuthenticated, 'user:', user?.email, 'isCheckingAuth:', isCheckingAuth)

  useEffect(() => {
    // Check if user is already authenticated on app load
    const checkAuth = async () => {
      await checkAuthStatus()
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, []) // Remove checkAuthStatus dependency to prevent infinite loop

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginForm 
        onLoginSuccess={(user, token) => {
          // Authentication state is managed by AuthManager
          console.log('Login successful:', user.email)
          // No need to reload - AuthManager handles state updates
        }} 
      />
    )
  }

  // Show main application if authenticated
  return (
    <div>
      <Routes>
        <Route path="/" element={<TranscriptCleanerPro user={user} logout={logout} />} />
        <Route path="/transcript" element={<TranscriptCleanerPro user={user} logout={logout} />} />
        <Route path="/prompt-engineering" element={<PromptEngineeringDashboard user={user} logout={logout} />} />
      </Routes>
    </div>
  )
}

export default App
