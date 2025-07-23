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
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add any additional headers from options
    if (options.headers) {
      Object.assign(headers, options.headers)
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
      console.log('API request with auth token:', endpoint, `Bearer ${this.authToken.substring(0, 50)}...`)
    }

    // Create abort controller for timeout handling
    const controller = new AbortController()
    
    // Determine timeout based on endpoint (large evaluations need more time)
    const isLargeDataEndpoint = endpoint.includes('/evaluations/') && 
                               (endpoint.includes('/export') || !endpoint.includes('/process-turn'))
    const timeoutMs = isLargeDataEndpoint ? 120000 : 30000 // 2 minutes for large data, 30s for others
    
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    const config: RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    }

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)
      
      return await this.handleResponse<T>(response, endpoint)
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        const timeoutSeconds = Math.round(timeoutMs / 1000)
        throw new Error(`Request timeout after ${timeoutSeconds} seconds`)
      }
      
      throw error
    }
  }

  private async handleResponse<T>(response: Response, endpoint: string): Promise<T> {
    
    if (!response.ok) {
      // Try to extract detailed error message from response
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.detail) {
          errorMessage = errorData.detail
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else {
          errorMessage = `HTTP error! status: ${response.status}`
        }
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || `HTTP error! status: ${response.status}`
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  // HTTP methods
  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', signal })
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

  // Evaluation endpoints
  async createEvaluation(conversationId: string, data: {
    name: string
    description?: string
    prompt_template?: string
    settings?: any
  }) {
    return this.request(`/api/v1/evaluations/conversations/${conversationId}/evaluations`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getEvaluations(conversationId: string) {
    return this.request(`/api/v1/evaluations/conversations/${conversationId}/evaluations`)
  }

  async getEvaluationDetails(evaluationId: string, signal?: AbortSignal) {
    return this.request(`/api/v1/evaluations/${evaluationId}`, { signal })
  }

  async processTurn(evaluationId: string, turnId: string, settings?: any) {
    return this.request(`/api/v1/evaluations/${evaluationId}/process-turn`, {
      method: 'POST',
      body: JSON.stringify({
        turn_id: turnId,
        settings: settings || {}
      }),
    })
  }
  async processAllTurns(evaluationId: string) {
    return this.request(`/api/v1/evaluations/${evaluationId}/process-all`, {
      method: 'POST',
    })
  }

  async deleteEvaluation(evaluationId: string) {
    return this.request(`/api/v1/evaluations/${evaluationId}`, {
      method: 'DELETE',
    })
  }

  async exportEvaluation(evaluationId: string): Promise<any> {
    // Export evaluation data as JSON - refresh for TypeScript
    return this.request(`/api/v1/evaluations/${evaluationId}/export`)
  }

  // Legacy conversation endpoints (for raw turns)
  async parseTranscript(conversationId: string, rawTranscript: string) {
    return this.request(`/api/v1/conversations/${conversationId}/parse-transcript`, {
      method: 'POST',
      body: JSON.stringify({ raw_transcript: rawTranscript }),
    })
  }

  async getConversationTurns(conversationId: string) {
    return this.request(`/api/v1/conversations/${conversationId}/turns`)
  }

  // Variables endpoints
  async getVariableSuggestions(variableName: string, limit: number = 10) {
    return this.request(`/api/v1/variables/${variableName}/suggestions?limit=${limit}`)
  }

  async saveVariableValue(variableName: string, variableValue: string) {
    return this.request(`/api/v1/variables/${variableName}`, {
      method: 'POST',
      body: JSON.stringify({ variable_name: variableName, variable_value: variableValue }),
    })
  }

  async getAllVariableSuggestions() {
    return this.request('/api/v1/variables/all-suggestions')
  }

  // Function Prompt Template endpoints
  async getFunctionPromptTemplates() {
    return this.request('/api/v1/prompt-engineering/function-templates')
  }

  async getFunctionPromptTemplate(templateId: string) {
    return this.request(`/api/v1/prompt-engineering/function-templates/${templateId}`)
  }

  async createFunctionPromptTemplate(data: {
    name: string
    description: string
    template: string
    variables: string[]
    custom_function_descriptions?: Record<string, string>
  }) {
    return this.request('/api/v1/prompt-engineering/function-templates', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateFunctionPromptTemplate(templateId: string, data: {
    name?: string
    description?: string
    template?: string
    variables?: string[]
    is_default?: boolean
    custom_function_descriptions?: Record<string, string>
  }) {
    return this.request(`/api/v1/prompt-engineering/function-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteFunctionPromptTemplate(templateId: string) {
    return this.request(`/api/v1/prompt-engineering/function-templates/${templateId}`, {
      method: 'DELETE'
    })
  }

  async setFunctionPromptTemplateAsDefault(templateId: string) {
    return this.request(`/api/v1/prompt-engineering/function-templates/${templateId}/set-default`, {
      method: 'POST'
    })
  }

  // Customer endpoints
  async getCustomers(search?: string, limit: number = 50, offset: number = 0) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const queryString = params.toString();
    return this.request(`/api/v1/customers/${queryString ? `?${queryString}` : ''}`);
  }

  async createCustomer(data: {
    user_name: string;
    job_title: string;
    company_name: string;
    company_description: string;
    company_size: string;
    company_sector: string;
    is_default?: boolean;
  }) {
    return this.request('/api/v1/customers/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCustomer(customerId: string) {
    return this.request(`/api/v1/customers/${customerId}`);
  }

  async updateCustomer(customerId: string, data: {
    user_name?: string;
    job_title?: string;
    company_name?: string;
    company_description?: string;
    company_size?: string;
    company_sector?: string;
    is_default?: boolean;
  }) {
    return this.request(`/api/v1/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(customerId: string) {
    return this.request(`/api/v1/customers/${customerId}`, {
      method: 'DELETE',
    });
  }

  async setDefaultCustomer(customerId: string) {
    return this.request(`/api/v1/customers/${customerId}/set-default`, {
      method: 'POST',
    });
  }

  async getDefaultCustomer() {
    return this.request('/api/v1/customers/default');
  }

  // Mirrored customer methods for evaluations
  async getMirroredCustomer(evaluationId: string) {
    return this.request(`/api/v1/customers/mirrored/${evaluationId}`);
  }

  async updateBusinessInsights(evaluationId: string, insights: any, appendMode: boolean = true) {
    return this.request(`/api/v1/customers/mirrored/${evaluationId}/insights`, {
      method: 'POST',
      body: JSON.stringify({
        insights,
        append_mode: appendMode,
      }),
    });
  }
}

export const apiClient = new APIClient()