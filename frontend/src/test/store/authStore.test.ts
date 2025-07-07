import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../lib/api'

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    login: vi.fn(),
    logout: vi.fn(),
    setAuthToken: vi.fn()
  }
}))

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false
    })
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const { user, token, isLoading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
    expect(isLoading).toBe(false)
  })

  it('handles successful login', async () => {
    const mockResponse = {
      access_token: 'test-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: '2025-01-07T00:00:00Z'
      }
    }

    vi.mocked(apiClient.login).mockResolvedValue(mockResponse)

    const { login } = useAuthStore.getState()
    await login('test@example.com', 'password')

    const { user, token, isLoading } = useAuthStore.getState()
    expect(user).toEqual(mockResponse.user)
    expect(token).toBe('test-token')
    expect(isLoading).toBe(false)
    expect(apiClient.setAuthToken).toHaveBeenCalledWith('test-token')
  })

  it('handles login error', async () => {
    vi.mocked(apiClient.login).mockRejectedValue(new Error('Login failed'))

    const { login } = useAuthStore.getState()
    
    await expect(login('test@example.com', 'wrong-password')).rejects.toThrow('Login failed')
    
    const { user, token, isLoading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
    expect(isLoading).toBe(false)
  })

  it('handles logout', async () => {
    // Set initial state
    useAuthStore.setState({
      user: { id: 'test-id', email: 'test@example.com', created_at: '2025-01-07T00:00:00Z' },
      token: 'test-token'
    })

    const { logout } = useAuthStore.getState()
    await logout()

    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
    expect(apiClient.logout).toHaveBeenCalled()
    expect(apiClient.setAuthToken).toHaveBeenCalledWith(null)
  })

  it('sets loading state during login', async () => {
    let resolveLogin: (value: any) => void
    const loginPromise = new Promise(resolve => { resolveLogin = resolve })
    vi.mocked(apiClient.login).mockReturnValue(loginPromise)

    const { login } = useAuthStore.getState()
    const loginCall = login('test@example.com', 'password')

    // Check loading state is true during login
    expect(useAuthStore.getState().isLoading).toBe(true)

    // Resolve login
    resolveLogin!({
      access_token: 'test-token',
      user: { id: 'test-id', email: 'test@example.com', created_at: '2025-01-07T00:00:00Z' }
    })
    await loginCall

    // Check loading state is false after login
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})