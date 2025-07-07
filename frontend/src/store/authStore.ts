import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '../lib/api'

interface User {
  id: string
  email: string
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await apiClient.login(email, password)
          const { access_token, user } = response
          
          set({ 
            token: access_token, 
            user,
            isLoading: false 
          })
          
          apiClient.setAuthToken(access_token)
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await apiClient.logout()
        } finally {
          set({ user: null, token: null })
          apiClient.setAuthToken(null)
        }
      },

      setUser: (user: User | null) => set({ user }),
      setToken: (token: string | null) => {
        set({ token })
        apiClient.setAuthToken(token)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
    }
  )
)