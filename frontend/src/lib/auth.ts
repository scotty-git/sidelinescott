import React from 'react'
import { apiClient } from './api'

export interface User {
  id: string
  email: string
  created_at: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

class AuthManager {
  private static instance: AuthManager
  private authState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false
  }
  private listeners: ((state: AuthState) => void)[] = []

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }

  constructor() {
    // Initialize from localStorage on startup
    this.initializeFromStorage()
  }

  private initializeFromStorage() {
    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('auth_user')
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        this.setAuthState({ user, token, isAuthenticated: true })
        
        // Set API client default headers
        this.setApiAuthHeader(token)
      } catch (error) {
        console.error('Failed to parse stored user data:', error)
        this.clearAuth()
      }
    }
  }

  private setAuthState(state: AuthState) {
    this.authState = { ...state } // Create new object reference
    this.notifyListeners()
  }

  private notifyListeners() {
    // Always create a new object reference to trigger React re-renders
    this.listeners.forEach(listener => listener({ ...this.authState }))
  }

  private setApiAuthHeader(token: string) {
    // Set auth token in API client
    apiClient.setAuthToken(token)
  }

  private clearApiAuthHeader() {
    // Clear auth token from API client
    apiClient.setAuthToken(null)
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  getAuthState(): AuthState {
    return { ...this.authState }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const response = await apiClient.post('/api/v1/auth/login', {
        email,
        password
      })

      const { user, access_token } = response as any

      // Store in localStorage
      localStorage.setItem('auth_token', access_token)
      localStorage.setItem('auth_user', JSON.stringify(user))

      // Update state
      this.setAuthState({
        user,
        token: access_token,
        isAuthenticated: true
      })

      // Set API client auth header
      this.setApiAuthHeader(access_token)

    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    console.log('AuthManager: Starting logout process...')

    // For now, skip the backend call and just clear local state
    // The backend logout doesn't do anything important anyway
    console.log('AuthManager: Clearing local auth state...')
    this.clearAuth()
    console.log('AuthManager: Logout process completed')
  }

  private clearAuth() {
    // Clear localStorage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    
    // Clear API client auth header
    this.clearApiAuthHeader()
    
    // Update state
    this.setAuthState({
      user: null,
      token: null,
      isAuthenticated: false
    })
  }

  async checkAuthStatus(): Promise<boolean> {
    if (!this.authState.token) {
      return false
    }

    try {
      // Verify token is still valid
      const response = await apiClient.get('/api/v1/auth/me')
      
      // Update user info in case it changed
      const user = response as any
      this.setAuthState({
        user,
        token: this.authState.token,
        isAuthenticated: true
      })
      
      return true
    } catch (error) {
      console.error('Auth check failed:', error)
      this.clearAuth()
      return false
    }
  }
}

export const authManager = AuthManager.getInstance()

// React hook for using auth state in components
export function useAuth() {
  const [authState, setAuthState] = React.useState(() => authManager.getAuthState())

  React.useEffect(() => {
    const unsubscribe = authManager.subscribe((newState) => {
      // Remove the _updateCounter before setting state
      const { _updateCounter, ...cleanState } = newState as any
      setAuthState(cleanState)
    })

    return unsubscribe
  }, [])

  return {
    ...authState,
    login: authManager.login.bind(authManager),
    logout: authManager.logout.bind(authManager),
    checkAuthStatus: authManager.checkAuthStatus.bind(authManager)
  }
}