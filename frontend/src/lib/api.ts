const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export class APIClient {
  private baseURL: string
  private authToken: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // Health check
  async checkHealth() {
    return this.request('/health')
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async logout() {
    return this.request('/api/v1/auth/logout', {
      method: 'POST',
    })
  }

  // Conversations endpoints
  async getConversations() {
    return this.request('/api/v1/conversations')
  }

  async createConversation(name: string, description?: string) {
    return this.request('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async getConversation(id: string) {
    return this.request(`/api/v1/conversations/${id}`)
  }

  async deleteConversation(id: string) {
    return this.request(`/api/v1/conversations/${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new APIClient()