# API Design - Real-time Architecture & WebSocket Integration

## 🎯 Architecture Overview

This document defines the complete API architecture for the Lumen Transcript Cleaner rebuild, focusing on real-time processing, message queue systems, and sub-100ms user feedback through WebSocket integration with Supabase.

**Core Principles:**
- **Real-time first**: Every operation provides immediate feedback
- **Message queue reliability**: FIFO processing ensures no lost operations
- **Stateful conversations**: Maintain cleaned history throughout sessions
- **Sub-100ms UI feedback**: Instant response to user actions
- **Scalable design**: Handle multiple concurrent cleaning sessions

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   REST Client   │  │  WebSocket      │                 │
│  │                 │  │  Manager        │                 │
│  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   FastAPI       │ │   Supabase      │ │   Message       │
│   REST API      │ │   Realtime      │ │   Queue         │
│                 │ │   (WebSockets)  │ │   (Redis)       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │   PostgreSQL    │
                │   Database      │
                └─────────────────┘
```

## 🔌 REST API Endpoints

### Base Configuration
```
Base URL: http://127.0.0.1:8000/api/v1
Content-Type: application/json
Authentication: Bearer <jwt_token>
```

### Authentication Endpoints

```typescript
// POST /api/v1/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
  expires_in: number;
}

// POST /api/v1/auth/refresh
interface RefreshRequest {
  refresh_token: string;
}

interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// POST /api/v1/auth/logout
interface LogoutRequest {
  refresh_token: string;
}
```

### Conversation Management

```typescript
// POST /api/v1/conversations
interface CreateConversationRequest {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface ConversationResponse {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  turns_count: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

// GET /api/v1/conversations
interface ListConversationsResponse {
  conversations: ConversationResponse[];
  total: number;
  page: number;
  per_page: number;
}

// GET /api/v1/conversations/{conversation_id}
// Returns: ConversationResponse

// DELETE /api/v1/conversations/{conversation_id}
// Returns: { success: boolean }
```

### Turn Processing (Core CleanerContext Implementation)

```typescript
// POST /api/v1/conversations/{conversation_id}/turns
interface ProcessTurnRequest {
  speaker: 'User' | 'Lumen';
  raw_text: string;
  shared_context?: string;
  force_cleaning_level?: 'none' | 'light' | 'full';
}

interface ProcessTurnResponse {
  turn_id: string;
  conversation_id: string;
  speaker: 'User' | 'Lumen';
  raw_text: string;
  cleaned_text: string;
  metadata: {
    confidence_score: 'HIGH' | 'MEDIUM' | 'LOW';
    cleaning_applied: boolean;
    cleaning_level: 'none' | 'light' | 'full';
    processing_time_ms: number;
    corrections: Correction[];
    context_detected: string;
    ai_model_used: string;
  };
  created_at: string;
}

interface Correction {
  original: string;
  corrected: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  position: {
    start: number;
    end: number;
  };
}

// GET /api/v1/conversations/{conversation_id}/turns
interface ListTurnsResponse {
  turns: ProcessTurnResponse[];
  total: number;
  raw_transcript: ProcessTurnResponse[];     // For debugging
  cleaned_transcript: ProcessTurnResponse[]; // For context
}
```

### Real-time Processing Status

```typescript
// GET /api/v1/conversations/{conversation_id}/status
interface ConversationStatusResponse {
  conversation_id: string;
  status: 'idle' | 'processing' | 'error';
  queue_position?: number;
  estimated_wait_ms?: number;
  active_contexts: string[];
  confidence_distribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  processing_stats: {
    total_turns: number;
    user_turns_processed: number;
    lumen_turns_skipped: number;
    average_processing_time_ms: number;
  };
}

// POST /api/v1/conversations/{conversation_id}/pause
// POST /api/v1/conversations/{conversation_id}/resume
// Returns: ConversationStatusResponse
```

### Context Management

```typescript
// POST /api/v1/conversations/{conversation_id}/context
interface UpdateContextRequest {
  shared_context: string;
  context_type: 'user_info' | 'business_info' | 'session_notes';
}

interface ContextResponse {
  conversation_id: string;
  shared_context: string;
  context_type: string;
  active_contexts: string[];
  context_transitions: {
    timestamp: string;
    from_contexts: string[];
    to_contexts: string[];
  }[];
  updated_at: string;
}

// GET /api/v1/conversations/{conversation_id}/context
// Returns: ContextResponse
```

### Analytics & Quality Metrics

```typescript
// GET /api/v1/conversations/{conversation_id}/analytics
interface ConversationAnalyticsResponse {
  conversation_id: string;
  quality_metrics: {
    transcription_accuracy: number;        // 0.0 - 1.0
    high_confidence_rate: number;          // 0.0 - 1.0
    appropriate_cleaning_decisions: number; // 0.0 - 1.0
    user_self_correction_rate: number;     // 0.0 - 1.0
  };
  performance_metrics: {
    average_processing_time_ms: number;
    p95_processing_time_ms: number;
    total_processing_time_ms: number;
    lumen_skip_efficiency: number;         // Time saved by skipping
  };
  confidence_breakdown: {
    HIGH: { count: number; percentage: number };
    MEDIUM: { count: number; percentage: number };
    LOW: { count: number; percentage: number };
  };
  context_analysis: {
    detected_contexts: string[];
    context_accuracy: number;
    context_transitions: number;
  };
}
```

## 🔄 WebSocket Integration with Supabase

### Connection Management

```typescript
// Frontend WebSocket manager
class SupabaseRealtimeManager {
  private supabase: SupabaseClient;
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  
  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }
  
  subscribeToConversation(conversationId: string): Promise<void> {
    const channel = this.supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'turns',
        filter: `conversation_id=eq.${conversationId}`
      }, this.handleTurnUpdate)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`
      }, this.handleConversationUpdate)
      .subscribe();
    
    this.subscriptions.set(conversationId, channel);
  }
  
  private handleTurnUpdate = (payload: any) => {
    const turnData = payload.new as ProcessTurnResponse;
    
    // Immediate UI feedback (< 100ms)
    this.emit('turn:processed', {
      conversationId: turnData.conversation_id,
      turn: turnData,
      timestamp: Date.now()
    });
    
    // Update confidence indicators
    this.emit('confidence:updated', {
      confidence: turnData.metadata.confidence_score,
      corrections: turnData.metadata.corrections
    });
  };
  
  private handleConversationUpdate = (payload: any) => {
    const conversationData = payload.new as ConversationResponse;
    
    this.emit('conversation:updated', {
      conversation: conversationData,
      timestamp: Date.now()
    });
  };
}
```

### Real-time Event Types

```typescript
// WebSocket event specifications
interface RealtimeEvents {
  // Turn processing events
  'turn:processing': {
    conversation_id: string;
    turn_id: string;
    estimated_completion_ms: number;
  };
  
  'turn:processed': {
    conversation_id: string;
    turn: ProcessTurnResponse;
    timestamp: number;
  };
  
  'turn:error': {
    conversation_id: string;
    turn_id: string;
    error: {
      code: string;
      message: string;
      details?: any;
    };
  };
  
  // Confidence and correction events
  'confidence:updated': {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    corrections: Correction[];
  };
  
  'correction:applied': {
    turn_id: string;
    correction: Correction;
    auto_applied: boolean;
  };
  
  // Context detection events
  'context:detected': {
    conversation_id: string;
    previous_contexts: string[];
    new_contexts: string[];
    transition_reason: string;
  };
  
  // Queue status events
  'queue:position': {
    conversation_id: string;
    position: number;
    estimated_wait_ms: number;
  };
  
  // System status events
  'system:status': {
    status: 'healthy' | 'degraded' | 'error';
    processing_capacity: number;
    queue_length: number;
  };
}
```

### Frontend Event Handlers

```typescript
// React hooks for real-time updates
export const useRealtimeConversation = (conversationId: string) => {
  const [turns, setTurns] = useState<ProcessTurnResponse[]>([]);
  const [status, setStatus] = useState<ConversationStatusResponse | null>(null);
  const [confidence, setConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW' | null>(null);
  
  useEffect(() => {
    const manager = new SupabaseRealtimeManager(supabase);
    
    manager.subscribeToConversation(conversationId);
    
    // Handle turn updates with immediate UI feedback
    manager.on('turn:processed', (event) => {
      setTurns(prev => [...prev, event.turn]);
      setConfidence(event.turn.metadata.confidence_score);
      
      // Trigger UI feedback animation
      toast.success(`Turn processed with ${event.turn.metadata.confidence_score} confidence`, {
        duration: 2000,
        position: 'bottom-right'
      });
    });
    
    // Handle confidence updates
    manager.on('confidence:updated', (event) => {
      setConfidence(event.confidence);
      
      // Show correction indicators in real-time
      if (event.corrections.length > 0) {
        event.corrections.forEach(correction => {
          showCorrectionIndicator(correction);
        });
      }
    });
    
    // Handle context transitions
    manager.on('context:detected', (event) => {
      updateContextIndicators(event.new_contexts);
    });
    
    return () => {
      manager.unsubscribeFromConversation(conversationId);
    };
  }, [conversationId]);
  
  return { turns, status, confidence };
};
```

## 📦 Message Queue System

### Redis-based FIFO Processing

```python
# Backend message queue implementation
import asyncio
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

@dataclass
class CleaningJob:
    job_id: str
    conversation_id: str
    turn_id: str
    speaker: str
    raw_text: str
    shared_context: Optional[str] = None
    priority: int = 1  # 1 = normal, 2 = high, 3 = urgent
    created_at: float = 0
    retry_count: int = 0
    max_retries: int = 3

class MessageQueueManager:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.processing = {}  # Track active jobs
        
    async def enqueue_cleaning_job(self, job: CleaningJob) -> str:
        """Add cleaning job to FIFO queue"""
        job.created_at = time.time()
        
        # Use priority queues for different urgency levels
        queue_name = f"cleaning_queue:priority_{job.priority}"
        
        job_data = json.dumps(asdict(job))
        await self.redis.lpush(queue_name, job_data)
        
        # Notify subscribers about queue position
        await self.notify_queue_status(job.conversation_id)
        
        return job.job_id
    
    async def process_queue(self):
        """Main queue processing loop"""
        while True:
            try:
                # Process high priority first, then normal
                for priority in [3, 2, 1]:
                    queue_name = f"cleaning_queue:priority_{priority}"
                    
                    job_data = await self.redis.brpop(queue_name, timeout=1)
                    if job_data:
                        _, job_json = job_data
                        job = CleaningJob(**json.loads(job_json))
                        
                        await self.process_cleaning_job(job)
                        break
                
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(1)
    
    async def process_cleaning_job(self, job: CleaningJob):
        """Process individual cleaning job"""
        try:
            # Mark job as processing
            self.processing[job.job_id] = job
            
            # Send processing notification
            await self.notify_processing_started(job)
            
            # Skip Lumen turns (CleanerContext requirement)
            if job.speaker in ['AI', 'Lumen']:
                result = await self.process_lumen_turn(job)
            else:
                result = await self.process_user_turn(job)
            
            # Send completion notification
            await self.notify_processing_completed(job, result)
            
            # Remove from processing
            del self.processing[job.job_id]
            
        except Exception as e:
            await self.handle_job_error(job, e)
    
    async def process_lumen_turn(self, job: CleaningJob) -> Dict[str, Any]:
        """Process Lumen turn (zero processing time)"""
        start_time = time.time()
        
        result = {
            'turn_id': job.turn_id,
            'conversation_id': job.conversation_id,
            'speaker': job.speaker,
            'raw_text': job.raw_text,
            'cleaned_text': job.raw_text,  # Lumen output is perfect
            'metadata': {
                'confidence_score': 'HIGH',
                'cleaning_applied': False,
                'cleaning_level': 'none',
                'processing_time_ms': (time.time() - start_time) * 1000,
                'corrections': [],
                'context_detected': 'lumen_response',
                'ai_model_used': 'none'
            }
        }
        
        return result
    
    async def process_user_turn(self, job: CleaningJob) -> Dict[str, Any]:
        """Process user turn with cleaning engine"""
        start_time = time.time()
        
        # Get conversation state for context
        conversation_state = await self.get_conversation_state(job.conversation_id)
        
        # Assess cleaning need
        cleaning_level = await self.assess_cleaning_need(job.raw_text)
        
        # Process based on cleaning level
        if cleaning_level == 'none':
            result = await self.passthrough_turn(job)
        else:
            result = await self.clean_turn_with_gemini(job, conversation_state, cleaning_level)
        
        result['metadata']['processing_time_ms'] = (time.time() - start_time) * 1000
        
        return result
```

### Queue Monitoring & Health

```python
class QueueHealthMonitor:
    def __init__(self, queue_manager: MessageQueueManager):
        self.queue_manager = queue_manager
        
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get current queue statistics"""
        stats = {}
        
        for priority in [1, 2, 3]:
            queue_name = f"cleaning_queue:priority_{priority}"
            length = await self.queue_manager.redis.llen(queue_name)
            stats[f"priority_{priority}_length"] = length
        
        stats.update({
            'total_queued': sum(stats.values()),
            'processing_count': len(self.queue_manager.processing),
            'average_processing_time_ms': await self.get_average_processing_time(),
            'queue_health': self.assess_queue_health(stats)
        })
        
        return stats
    
    async def assess_queue_health(self, stats: Dict[str, Any]) -> str:
        """Assess overall queue health"""
        total_queued = stats['total_queued']
        processing_count = stats['processing_count']
        
        if total_queued == 0 and processing_count == 0:
            return 'healthy'
        elif total_queued < 10 and processing_count < 5:
            return 'normal'
        elif total_queued < 50 and processing_count < 10:
            return 'busy'
        else:
            return 'overloaded'
```

## 🔐 Authentication & Security

### JWT Token Management

```python
# Backend JWT handling
from jose import JWTError, jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

class AuthManager:
    def __init__(self, supabase_jwt_secret: str):
        self.jwt_secret = supabase_jwt_secret
        self.algorithm = "HS256"
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def verify_supabase_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Supabase JWT token"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.algorithm])
            user_id = payload.get("sub")
            if user_id is None:
                return None
            return payload
        except JWTError:
            return None
    
    async def get_current_user(self, token: str) -> Optional[Dict[str, Any]]:
        """Get current user from token"""
        payload = self.verify_supabase_token(token)
        if payload:
            user_id = payload.get("sub")
            # Fetch user details from Supabase
            user = await self.fetch_user_by_id(user_id)
            return user
        return None

# FastAPI dependency for authentication
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_manager: AuthManager = Depends(get_auth_manager)
) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user"""
    user = await auth_manager.get_current_user(token)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
```

### Rate Limiting

```python
# Rate limiting for API endpoints
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Apply different limits for different endpoints
@app.post("/api/v1/conversations/{conversation_id}/turns")
@limiter.limit("10/minute")  # Max 10 turn processing requests per minute
async def process_turn(
    conversation_id: str,
    request: ProcessTurnRequest,
    request_obj: Request,
    current_user: Dict = Depends(get_current_user)
):
    # Processing logic here
    pass

@app.get("/api/v1/conversations/{conversation_id}/status")
@limiter.limit("60/minute")  # More generous for status checks
async def get_conversation_status(
    conversation_id: str,
    request_obj: Request,
    current_user: Dict = Depends(get_current_user)
):
    # Status logic here
    pass
```

## 🚨 Error Handling & Recovery

### Comprehensive Error Responses

```typescript
// Standardized error response format
interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    request_id: string;
  };
  recovery?: {
    suggested_action: string;
    retry_after_ms?: number;
    alternative_endpoints?: string[];
  };
}

// Error codes and their meanings
enum APIErrorCodes {
  // Authentication errors
  INVALID_TOKEN = 'AUTH_001',
  TOKEN_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',
  
  // Validation errors
  INVALID_REQUEST_FORMAT = 'VAL_001',
  MISSING_REQUIRED_FIELD = 'VAL_002',
  INVALID_FIELD_VALUE = 'VAL_003',
  
  // Processing errors
  CONVERSATION_NOT_FOUND = 'PROC_001',
  TURN_PROCESSING_FAILED = 'PROC_002',
  AI_MODEL_UNAVAILABLE = 'PROC_003',
  QUEUE_FULL = 'PROC_004',
  
  // System errors
  DATABASE_ERROR = 'SYS_001',
  EXTERNAL_SERVICE_ERROR = 'SYS_002',
  RATE_LIMIT_EXCEEDED = 'SYS_003',
  INTERNAL_SERVER_ERROR = 'SYS_004'
}
```

### Error Recovery Patterns

```python
# Backend error handling with retry logic
class ErrorHandler:
    def __init__(self):
        self.retry_strategies = {
            'AI_MODEL_UNAVAILABLE': self.retry_with_backoff,
            'DATABASE_ERROR': self.retry_immediate,
            'EXTERNAL_SERVICE_ERROR': self.retry_with_backoff,
            'QUEUE_FULL': self.retry_with_delay
        }
    
    async def handle_processing_error(
        self, 
        job: CleaningJob, 
        error: Exception
    ) -> bool:
        """Handle processing errors with appropriate recovery strategy"""
        
        error_code = self.classify_error(error)
        
        if job.retry_count >= job.max_retries:
            await self.send_final_error_notification(job, error)
            return False
        
        retry_strategy = self.retry_strategies.get(error_code)
        if retry_strategy:
            retry_delay = await retry_strategy(job, error)
            await self.schedule_retry(job, retry_delay)
            return True
        
        # No retry strategy - fail immediately
        await self.send_final_error_notification(job, error)
        return False
    
    async def retry_with_backoff(self, job: CleaningJob, error: Exception) -> int:
        """Exponential backoff retry strategy"""
        base_delay = 1000  # 1 second
        delay_ms = base_delay * (2 ** job.retry_count)
        return min(delay_ms, 30000)  # Cap at 30 seconds
    
    async def retry_immediate(self, job: CleaningJob, error: Exception) -> int:
        """Immediate retry for transient errors"""
        return 100  # 100ms delay
    
    async def retry_with_delay(self, job: CleaningJob, error: Exception) -> int:
        """Fixed delay retry"""
        return 5000  # 5 second delay
```

## 📊 Performance Monitoring

### Real-time Performance Metrics

```python
# Performance monitoring system
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'api_response_times': {},
            'queue_processing_times': {},
            'ai_model_latencies': {},
            'websocket_message_delays': {}
        }
    
    async def track_api_request(self, endpoint: str, duration_ms: float):
        """Track API request performance"""
        if endpoint not in self.metrics['api_response_times']:
            self.metrics['api_response_times'][endpoint] = []
        
        self.metrics['api_response_times'][endpoint].append(duration_ms)
        
        # Alert if exceeding targets
        if duration_ms > 100:  # Sub-100ms target for UI updates
            await self.send_performance_alert(endpoint, duration_ms)
    
    async def track_queue_processing(self, job_type: str, duration_ms: float):
        """Track queue processing performance"""
        if job_type not in self.metrics['queue_processing_times']:
            self.metrics['queue_processing_times'][job_type] = []
        
        self.metrics['queue_processing_times'][job_type].append(duration_ms)
    
    async def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        summary = {}
        
        for metric_type, endpoints in self.metrics.items():
            summary[metric_type] = {}
            
            for endpoint, times in endpoints.items():
                if times:
                    summary[metric_type][endpoint] = {
                        'count': len(times),
                        'avg_ms': sum(times) / len(times),
                        'min_ms': min(times),
                        'max_ms': max(times),
                        'p95_ms': self.percentile(times, 95),
                        'p99_ms': self.percentile(times, 99)
                    }
        
        return summary
```

## 🧪 API Testing Strategy

### Comprehensive Test Suite

```python
# Backend API tests
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
class TestTurnProcessingAPI:
    
    async def test_user_turn_processing_full_flow(self):
        """Test complete user turn processing with cleaning"""
        client = TestClient(app)
        
        # Create conversation
        conversation_response = client.post("/api/v1/conversations", json={
            "name": "Test Conversation",
            "description": "Test conversation for API testing"
        })
        conversation_id = conversation_response.json()["id"]
        
        # Process user turn with error patterns
        turn_request = {
            "speaker": "User",
            "raw_text": "I'm the vector of marketing at quick fit windows",
            "shared_context": "Business qualification call"
        }
        
        response = client.post(
            f"/api/v1/conversations/{conversation_id}/turns",
            json=turn_request
        )
        
        assert response.status_code == 200
        turn_data = response.json()
        
        # Verify CleanerContext implementation
        assert turn_data["cleaned_text"] == "I'm the Director of Marketing at Quick Fit Windows"
        assert turn_data["metadata"]["confidence_score"] == "HIGH"
        assert turn_data["metadata"]["cleaning_applied"] == True
        assert turn_data["metadata"]["cleaning_level"] == "full"
        assert len(turn_data["metadata"]["corrections"]) > 0
        
        # Verify correction details
        correction = turn_data["metadata"]["corrections"][0]
        assert correction["original"] == "vector of"
        assert correction["corrected"] == "Director of"
        assert correction["confidence"] == "HIGH"
    
    async def test_lumen_turn_skip_processing(self):
        """Test that Lumen turns are skipped (CleanerContext requirement)"""
        client = TestClient(app)
        conversation_id = await self.create_test_conversation()
        
        turn_request = {
            "speaker": "Lumen",
            "raw_text": "Thank you for that information. Can you tell me more?"
        }
        
        start_time = time.time()
        response = client.post(
            f"/api/v1/conversations/{conversation_id}/turns",
            json=turn_request
        )
        processing_time = (time.time() - start_time) * 1000
        
        assert response.status_code == 200
        turn_data = response.json()
        
        # Verify zero processing time
        assert turn_data["metadata"]["cleaning_applied"] == False
        assert turn_data["metadata"]["processing_time_ms"] < 10  # Near-zero
        assert turn_data["cleaned_text"] == turn_request["raw_text"]
        assert processing_time < 50  # Sub-50ms total API response
    
    async def test_stateful_conversation_context(self):
        """Test that cleaned history is used in sliding window"""
        client = TestClient(app)
        conversation_id = await self.create_test_conversation()
        
        # First turn with error
        turn1 = {
            "speaker": "User",
            "raw_text": "I'm the vector of marketing"
        }
        response1 = client.post(
            f"/api/v1/conversations/{conversation_id}/turns",
            json=turn1
        )
        
        # Second turn that should see cleaned context
        turn2 = {
            "speaker": "User",
            "raw_text": "As I mentioned, I work in marketing"
        }
        response2 = client.post(
            f"/api/v1/conversations/{conversation_id}/turns",
            json=turn2
        )
        
        # Verify that context includes cleaned version
        conversation_response = client.get(f"/api/v1/conversations/{conversation_id}/turns")
        turns = conversation_response.json()["cleaned_transcript"]
        
        assert "Director of Marketing" in turns[0]["cleaned_text"]
        assert "vector of marketing" not in turns[0]["cleaned_text"]
```

### WebSocket Testing

```typescript
// Frontend WebSocket tests
describe('Real-time WebSocket Integration', () => {
  let mockSupabase: any;
  let realtimeManager: SupabaseRealtimeManager;
  
  beforeEach(() => {
    mockSupabase = {
      channel: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    };
    
    realtimeManager = new SupabaseRealtimeManager(mockSupabase);
  });
  
  test('should provide sub-100ms feedback on turn processing', async () => {
    const conversationId = 'test-conversation-id';
    const feedbackReceived = jest.fn();
    
    realtimeManager.on('turn:processed', feedbackReceived);
    realtimeManager.subscribeToConversation(conversationId);
    
    // Simulate incoming turn data
    const mockTurnData = {
      conversation_id: conversationId,
      turn_id: 'test-turn-id',
      cleaned_text: 'Test cleaned text',
      metadata: {
        confidence_score: 'HIGH',
        processing_time_ms: 250
      }
    };
    
    const startTime = performance.now();
    
    // Trigger the mock WebSocket event
    const handleTurnUpdate = mockSupabase.on.mock.calls
      .find(call => call[0] === 'postgres_changes')[2];
    
    handleTurnUpdate({ new: mockTurnData });
    
    const feedbackTime = performance.now() - startTime;
    
    expect(feedbackReceived).toHaveBeenCalledWith({
      conversationId,
      turn: mockTurnData,
      timestamp: expect.any(Number)
    });
    expect(feedbackTime).toBeLessThan(100);
  });
});
```

---

This API design provides a complete real-time architecture that supports the cleanercontext.md vision while ensuring sub-100ms user feedback and reliable message processing through FIFO queues.