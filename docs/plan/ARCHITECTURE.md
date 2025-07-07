# Technical Architecture - Complete Rebuild Strategy

## Executive Summary

This document outlines the technical architecture for a complete rebuild of the Lumen Transcript Cleaner system. We're building from scratch using modern, proven technologies to implement the cleanercontext.md vision with exceptional UI/UX and sub-100ms performance targets.

**Core Philosophy**: Build the cleanercontext.md vision from the ground up using battle-tested technologies, studying existing functionality only to understand requirements (not implementation).

## 🎯 Technology Stack Decisions

### Frontend Foundation
```
Vite + React 19 + TypeScript + UnoCSS
```

**Rationale:**
- **Vite**: Lightning-fast HMR, optimized builds, excellent DX
- **React 19**: Latest features, concurrent rendering, enhanced performance
- **TypeScript**: Type safety, excellent tooling, reduced runtime errors
- **UnoCSS**: Utility-first CSS without Tailwind v4 alpha build issues

### Backend Foundation
```
FastAPI + Python 3.11+ + Async Architecture
```

**Rationale:**
- **FastAPI**: Modern async framework, excellent performance, auto-generated docs
- **Python 3.11+**: Latest performance improvements, enhanced async capabilities
- **Async-first**: Essential for real-time processing and AI model integration

### Database & Real-time
```
Supabase (PostgreSQL + Real-time + Auth)
```

**Rationale:**
- **PostgreSQL**: Robust, ACID compliant, excellent JSON support
- **Real-time subscriptions**: Built-in WebSocket capabilities
- **Authentication**: Production-ready auth with JWT tokens
- **Row Level Security**: Fine-grained access control

### AI Integration
```
Google Gemini 2.0 Flash + Structured JSON Output
```

**Rationale:**
- **Gemini 2.0 Flash**: Fast, cost-effective, excellent for conversation processing
- **Structured JSON**: Enables metadata-rich responses with confidence scoring
- **Async processing**: Non-blocking AI model calls

## 🏗️ Project Structure

```
sideline-rebuild/
├── frontend/                    # Vite + React 19 application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Base design system components
│   │   │   ├── features/      # Feature-specific components
│   │   │   └── layout/        # Layout and navigation
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API and business logic
│   │   ├── stores/            # State management (Zustand)
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Helper functions
│   ├── tests/                 # Frontend test suites
│   ├── uno.config.ts          # UnoCSS configuration
│   ├── vite.config.ts         # Vite configuration
│   └── package.json
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── core/              # Core business logic
│   │   │   ├── cleaner/       # Cleaning engine implementation
│   │   │   ├── analyzer/      # Function analysis engine
│   │   │   └── realtime/      # WebSocket and real-time handlers
│   │   ├── models/            # Database models
│   │   ├── services/          # External service integrations
│   │   ├── utils/             # Helper functions
│   │   └── tests/             # Backend test suites
│   ├── alembic/               # Database migrations
│   ├── requirements.txt       # Python dependencies
│   └── main.py                # Application entry point
│
├── shared/                     # Shared types and contracts
│   ├── types/                 # TypeScript type definitions
│   └── api-contracts/         # OpenAPI specifications
│
├── docs/                      # Documentation
├── docker/                    # Docker configurations
└── scripts/                   # Development and deployment scripts
```

## 🚀 Development Environment

### Local Development Setup
```bash
# Always use 127.0.0.1 for VPN compatibility
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend runs on 127.0.0.1:8000
# Frontend runs on 127.0.0.1:5173 (Vite default)
```

### Development Server Management
```bash
# Start backend in background (your preferred method)
cd backend && nohup uvicorn main:app --host 127.0.0.1 --port 8000 --reload > dev.log 2>&1 &

# Start frontend in background
cd frontend && nohup npm run dev > dev.log 2>&1 &

# Health check scripts
./scripts/check-health.sh
```

### Hot Reload Strategy
- **Frontend**: Vite's HMR for instant updates
- **Backend**: Uvicorn's reload flag for Python changes
- **Database**: Supabase handles schema changes with migrations

## ⚡ Performance Architecture

### Sub-100ms Targets

**UI Feedback Requirements:**
- Button clicks: < 50ms visual feedback
- Form interactions: < 100ms validation
- Page transitions: < 200ms
- Real-time updates: < 100ms from event to UI

**API Response Targets:**
- Simple queries: < 50ms
- AI cleaning operations: < 500ms
- Complex analysis: < 1000ms
- File uploads: < 200ms (excluding transfer time)

### Message Queue System
```python
# FIFO processing for reliable operation
class MessageQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        
    async def process_cleaning_requests(self):
        """Process cleaning requests in FIFO order"""
        while True:
            request = await self.queue.get()
            await self.process_single_request(request)
            self.queue.task_done()
```

### Real-time WebSocket Architecture
```typescript
// Frontend WebSocket management
class RealtimeManager {
  private ws: WebSocket;
  
  subscribeToCleaningUpdates(conversationId: string) {
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `cleaning:${conversationId}`
    }));
  }
  
  onMessage(callback: (data: any) => void) {
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };
  }
}
```

## 🔧 Core System Components

### 1. Stateful Conversation Manager
```typescript
interface ConversationState {
  id: string;
  rawTranscript: Turn[];      // Keep for debugging
  cleanedTranscript: Turn[];  // Use for context
  contextPatterns: string[];  // Track conversation topics
  confidenceScores: number[]; // Track cleaning confidence
}

class ConversationManager {
  async addTurn(raw: Turn): Promise<CleanedTurn> {
    // Skip Lumen turns (they're perfect)
    if (raw.speaker === 'Lumen') {
      return this.passthrough(raw);
    }
    
    // Clean user turns using cleaned history as context
    const cleanedHistory = this.getCleanedSlidingWindow();
    return await this.cleanUserTurn(raw, cleanedHistory);
  }
}
```

### 2. Intelligent Cleaning Decision Engine
```typescript
class CleaningDecisionEngine {
  assessCleaningNeed(rawTurn: string): 'none' | 'light' | 'full' {
    if (this.isSimpleAcknowledgment(rawTurn)) {
      return 'none'; // "Yes", "That's right", "Correct"
    }
    
    if (this.isClearButNeedsFormatting(rawTurn)) {
      return 'light'; // Fix punctuation, capitalization
    }
    
    if (this.containsErrorPatterns(rawTurn)) {
      return 'full'; // Known STT errors, numbers to convert
    }
    
    return 'light'; // Default to light touch
  }
}
```

### 3. Flexible Context Detection
```typescript
class ContextDetector {
  private contextMarkers = {
    'identity_discussion': ['job title', 'role', 'position', 'director'],
    'company_info': ['employees', 'team size', 'based in', 'services'],
    'marketing_discussion': ['channels', 'PPC', 'Facebook', 'leads'],
    'motivation': ['interested', 'looking for', 'challenge', 'problem']
  };
  
  detectActiveContexts(cleanedHistory: Turn[]): string[] {
    // Returns multiple contexts - conversations are dynamic
    const activeContexts: string[] = [];
    const recentText = cleanedHistory.slice(-3).join(' ').toLowerCase();
    
    for (const [context, markers] of Object.entries(this.contextMarkers)) {
      if (markers.some(marker => recentText.includes(marker))) {
        activeContexts.push(context);
      }
    }
    
    return activeContexts;
  }
}
```

### 4. Real-time Self-Correcting System
```typescript
class SelfCorrectingSystem {
  async handleUserCorrection(originalData: any, correction: string) {
    // User sees screen update with cleaned data
    // If incorrect, user naturally corrects it
    // New turn gets processed → updated function call → screen updates
    
    const newTurn = await this.processCorrection(correction);
    await this.updateUI(newTurn);
    await this.notifySubscribers(newTurn);
  }
}
```

## 🎨 UI/UX Architecture Principles

### Reconnaissance-First Component Development
```typescript
// Before building any component:
// 1. Study 3-5 similar components in the design system
// 2. Identify spacing, colors, typography patterns
// 3. Follow existing interactive behaviors
// 4. Ensure responsive consistency

interface ComponentDevelopmentProcess {
  reconnaissance: () => void;  // Study existing patterns
  consistency: () => void;     // Match established patterns
  interaction: () => void;     // Same hover/focus/transitions
  hierarchy: () => void;       // Use established typography
  modernUX: () => void;       // Loading/empty/error states
}
```

### Progressive Disclosure Pattern
```typescript
// Don't overwhelm - reveal complexity gradually
class ProgressiveDisclosure {
  renderBasicView() {
    // Show essential information first
  }
  
  renderDetailedView() {
    // Reveal on user interaction
  }
  
  renderAdvancedOptions() {
    // Expert features behind clear controls
  }
}
```

### Sub-100ms Feedback System
```typescript
// Every user action gets immediate visual response
class FeedbackSystem {
  onUserInteraction(element: HTMLElement) {
    // Immediate visual feedback (< 50ms)
    element.classList.add('interaction-active');
    
    // Process the actual action
    this.processAction();
    
    // Update with results
    this.updateWithResults();
  }
}
```

## 🔐 Security & Authentication

### Supabase Authentication Flow
```typescript
// JWT-based auth with automatic token refresh
class AuthManager {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (data.session) {
      this.storeSession(data.session);
      this.setupAutoRefresh();
    }
  }
  
  private setupAutoRefresh() {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.updateStoredSession(session);
      }
    });
  }
}
```

### Row Level Security (RLS)
```sql
-- Conversations are user-specific
CREATE POLICY "Users can only access their own conversations"
ON conversations FOR ALL
USING (auth.uid() = user_id);

-- Real-time subscriptions respect RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
```

## 📊 Monitoring & Observability

### Performance Monitoring
```typescript
class PerformanceMonitor {
  trackUserInteraction(action: string, startTime: number) {
    const duration = performance.now() - startTime;
    
    // Alert if exceeding targets
    if (duration > 100) {
      this.reportSlowInteraction(action, duration);
    }
    
    // Track metrics
    this.recordMetric('interaction_time', duration, { action });
  }
}
```

### Quality Metrics Dashboard
```typescript
interface QualityMetrics {
  transcriptionAccuracy: number;     // > 95% target
  highConfidenceRate: number;        // > 70% target
  appropriateCleaningDecisions: number; // > 85% target
  userSelfCorrectionRate: number;    // < 10% target
  lumenProcessingTime: number;       // 0ms (skipped)
}
```

## 🚀 Deployment Strategy

### Docker Configuration
```dockerfile
# Frontend (Vite build)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5173

# Backend (FastAPI)
FROM python:3.11-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Environment
```bash
# Environment variables for production
ENVIRONMENT=production
API_URL=https://api.your-domain.com
SUPABASE_URL=https://your-project.supabase.co
GEMINI_API_KEY=your-production-key

# Health checks and monitoring
HEALTH_CHECK_INTERVAL=30s
LOG_LEVEL=info
METRICS_ENABLED=true
```

## 🧪 Testing Integration

### Test-Driven Development Flow
```typescript
// Write tests before implementation
describe('CleaningDecisionEngine', () => {
  it('should return "none" for simple acknowledgments', () => {
    const engine = new CleaningDecisionEngine();
    expect(engine.assessCleaningNeed('Yes')).toBe('none');
    expect(engine.assessCleaningNeed('That\'s right')).toBe('none');
  });
  
  it('should return "full" for error patterns', () => {
    const engine = new CleaningDecisionEngine();
    expect(engine.assessCleaningNeed('I\'m the vector of marketing')).toBe('full');
  });
});
```

### Quality Gates
- **Unit tests**: 90%+ coverage before merge
- **Integration tests**: All API endpoints covered
- **Performance tests**: Sub-100ms targets verified
- **E2E tests**: Critical user flows automated

## 🎯 Success Criteria

### Technical Metrics
- **Build time**: < 30 seconds for development builds
- **Hot reload**: < 1 second for code changes
- **Bundle size**: < 2MB for frontend assets
- **API response**: 95th percentile under targets

### Business Metrics
- **Transcription accuracy**: > 95%
- **High confidence corrections**: > 70%
- **User self-correction rate**: < 10%
- **System availability**: > 99.5%

---

This architecture provides a solid foundation for building the cleanercontext.md vision with modern technologies, excellent performance, and exceptional user experience. The next phase involves detailed implementation planning for each component.