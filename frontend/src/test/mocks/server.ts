import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock API handlers for testing
export const handlers = [
  // Health check endpoint  
  http.get('http://localhost:8000/health', ({ request }) => {
    // Check for test error scenario
    const url = new URL(request.url)
    if (url.searchParams.get('error') === 'true') {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  }),

  // Auth endpoints
  http.post('http://localhost:8000/api/v1/auth/login', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'test-user-id',
        email: body.email,
        created_at: new Date().toISOString()
      },
      expires_in: 172800  // 48 hours in seconds
    })
  }),

  // Conversations endpoints
  http.get('http://localhost:8000/api/v1/conversations', () => {
    return HttpResponse.json({
      conversations: [
        {
          id: 'test-conversation-1',
          name: 'Test Conversation',
          status: 'active',
          turns_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {}
        }
      ],
      total: 1,
      page: 1,
      per_page: 20
    })
  }),

  http.post('http://localhost:8000/api/v1/conversations', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'new-conversation-id',
      name: body.name,
      description: body.description,
      status: 'active',
      turns_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: body.metadata || {}
    })
  }),

  // Turn processing endpoints
  http.post('http://localhost:8000/api/v1/conversations/:id/turns', async ({ params, request }) => {
    const body = await request.json()
    const isLumenTurn = body.speaker === 'Lumen'
    
    return HttpResponse.json({
      turn_id: 'test-turn-id',
      conversation_id: params.id,
      speaker: body.speaker,
      raw_text: body.raw_text,
      cleaned_text: isLumenTurn ? body.raw_text : "I'm the Director of Marketing",
      metadata: {
        confidence_score: 'HIGH',
        cleaning_applied: !isLumenTurn,
        cleaning_level: isLumenTurn ? 'none' : 'full',
        processing_time_ms: isLumenTurn ? 5 : 250,
        corrections: isLumenTurn ? [] : [
          {
            original: 'vector of',
            corrected: 'Director of',
            confidence: 'HIGH',
            reason: 'contextual_understanding'
          }
        ],
        context_detected: 'identity_discussion',
        ai_model_used: isLumenTurn ? 'none' : 'gemini-pro'
      },
      created_at: new Date().toISOString()
    })
  })
]

// Create the server instance
export const server = setupServer(...handlers)