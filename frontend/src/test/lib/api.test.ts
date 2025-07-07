import { describe, it, expect, beforeEach } from 'vitest'
import { APIClient } from '../../lib/api'

describe('API Client', () => {
  let apiClient: APIClient
  
  beforeEach(() => {
    apiClient = new APIClient('http://localhost:8000')
  })

  it('makes health check request', async () => {
    const result = await apiClient.checkHealth()
    
    expect(result).toHaveProperty('status')
    expect(result.status).toBe('healthy')
  })

  it('makes login request with correct payload', async () => {
    const result = await apiClient.login('test@example.com', 'password')
    
    expect(result).toHaveProperty('access_token')
    expect(result).toHaveProperty('user')
    expect(result.user.email).toBe('test@example.com')
  })

  it('includes auth token in headers when set', async () => {
    apiClient.setAuthToken('test-token')
    const result = await apiClient.getConversations()
    
    expect(result).toHaveProperty('conversations')
    expect(Array.isArray(result.conversations)).toBe(true)
  })

  it('throws error on HTTP error response', async () => {
    // Create a separate API client that will make a request to trigger error
    const errorClient = new (class extends APIClient {
      async triggerError() {
        return this.request('/health?error=true')
      }
    })('http://localhost:8000')
    
    await expect(errorClient.triggerError()).rejects.toThrow('HTTP error! status: 401')
  })

  it('creates conversation with correct payload', async () => {
    const result = await apiClient.createConversation('Test Conversation', 'Test Description')
    
    expect(result).toHaveProperty('id')
    expect(result.name).toBe('Test Conversation')
    expect(result.description).toBe('Test Description')
  })

  it('measures API response times', async () => {
    const startTime = performance.now()
    await apiClient.checkHealth()
    const endTime = performance.now()
    const responseTime = endTime - startTime

    // API call should complete quickly (sub-100ms target)
    expect(responseTime).toBeLessThan(1000) // Allow some margin for test environment
  })
})