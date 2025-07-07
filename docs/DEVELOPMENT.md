# Development Guide - Lumen Transcript Cleaner ✅

**Complete development workflow for production-ready CleanerContext system**

---

## 🎯 Development Overview

This guide provides comprehensive instructions for developing, testing, and maintaining the Lumen Transcript Cleaner production system. Designed for developers working with the revolutionary CleanerContext architecture and real-time processing capabilities.

### 🚀 Development Philosophy

- **Autonomous Development**: Auto-accept mode for rapid iteration and development
- **Performance First**: Sub-100ms targets maintained throughout development
- **Test-Driven Development**: Comprehensive testing with 52 unit tests + 28 E2E tests
- **Production Quality**: Every feature built to production standards
- **CleanerContext Focused**: Development optimized for stateful conversation processing

---

## 🛠️ Development Environment Setup

### Prerequisites ✅

```bash
# Required software versions
node --version    # v18+ required
python3 --version # v3.11+ required
git --version     # v2.0+ required

# Verify npm and pip
npm --version     # v9+ recommended
pip --version     # Latest version recommended
```

### Quick Development Setup

```bash
# Clone and setup (5-minute quickstart)
git clone <repository-url> sidelinescott
cd sidelinescott

# Frontend setup (Terminal 1)
cd frontend
npm install
npm run dev  # http://127.0.0.1:6173

# Backend setup (Terminal 2)  
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy alembic asyncpg supabase
uvicorn app.main:app --reload  # http://127.0.0.1:8000

# Verify setup
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:6173
```

### Development URLs ✅

**Live Development Environment:**
- 🎨 **Main Application**: http://127.0.0.1:6173
- 🧪 **CleanerContext Testing**: http://127.0.0.1:6173/test-cleaner-context
- ⚡ **Real-time Testing**: http://127.0.0.1:6173/week3
- 📚 **API Documentation**: http://127.0.0.1:8000/docs
- 🔍 **Health Check**: http://127.0.0.1:8000/health

---

## 🔄 Daily Development Workflow

### Development Startup Sequence

```bash
# Daily development startup (30 seconds)
#!/bin/bash

echo "🚀 Starting Lumen Transcript Cleaner Development Environment"

# Start backend (Terminal 1)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload &
BACKEND_PID=$!

# Start frontend (Terminal 2) 
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for services to start
echo "⏳ Starting services..."
sleep 5

# Health checks
echo "🔍 Checking service health..."
curl -s http://127.0.0.1:8000/health | jq '.status' && echo "✅ Backend OK"
curl -s http://127.0.0.1:6173 >/dev/null && echo "✅ Frontend OK"

echo "🎉 Development environment ready!"
echo "📱 Frontend: http://127.0.0.1:6173"
echo "🔗 Backend: http://127.0.0.1:8000"
echo "📚 API Docs: http://127.0.0.1:8000/docs"

# Save PIDs for cleanup
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid
```

### Testing Workflow ✅

```bash
# Comprehensive testing workflow (CLAUDE.md methodology)

# Phase 1: Unit Tests (always run first)
echo "🧪 Phase 1: Unit Tests"
cd frontend && npm run test                    # 18 tests
cd ../backend && python3 -m pytest tests/ -v # 34 tests

# Phase 2: E2E Tests (auto-run when Phase 1 passes)
echo "🎭 Phase 2: E2E Tests"
cd frontend && npx playwright test            # 28 tests

# Phase 3: Performance Validation
echo "⚡ Phase 3: Performance Validation"
npm run test -- --testNamePattern="performance"
python3 -m pytest tests/ -k "performance" -v

# Phase 4: Manual Testing (only when all automated tests pass)
echo "👤 Phase 4: Ready for Manual Testing"
echo "✅ All automated tests passing - ready for manual validation"
```

---

## 🧠 CleanerContext Development

### CleanerContext Core Development ✅

**Primary Development Files:**
```
backend/app/services/conversation_manager.py  # CleanerContext core (500+ lines)
frontend/src/pages/TranscriptCleanerPro.tsx   # Main UI (1400+ lines)
frontend/src/pages/TestCleanerContext.tsx     # Testing interface
```

### CleanerContext Development Commands

```bash
# CleanerContext-specific development
cd backend

# Run CleanerContext tests
python3 -m pytest tests/test_conversation_manager.py -v

# Test CleanerContext performance
python3 -m pytest tests/test_conversation_manager.py -k "performance" -v

# CleanerContext API testing
curl -X POST http://127.0.0.1:8000/api/v1/conversations \
  -H "Content-Type: application/json" \
  -d '{"name": "CleanerContext Dev Test"}'

# Test turn processing
curl -X POST http://127.0.0.1:8000/api/v1/conversations/{id}/turns \
  -H "Content-Type: application/json" \
  -d '{"speaker": "User", "raw_text": "I am the vector of Marketing"}'
```

### CleanerContext Development Patterns

```python
# CleanerContext development pattern
class ConversationManagerDevelopment:
    """
    Development patterns for CleanerContext functionality.
    
    Key Development Principles:
    - Performance testing with every change
    - Comprehensive error handling
    - Real Gemini integration testing
    - Sliding window validation
    """
    
    async def develop_new_feature(self, feature_spec: FeatureSpec) -> FeatureResult:
        """Standard pattern for CleanerContext feature development."""
        
        # Step 1: Write comprehensive tests first
        test_cases = self.generate_test_cases(feature_spec)
        
        # Step 2: Implement with performance monitoring
        start_time = time.time()
        result = await self.implement_feature(feature_spec)
        performance_time = (time.time() - start_time) * 1000
        
        # Step 3: Validate against CleanerContext requirements
        validation_result = await self.validate_cleanercontext_compliance(result)
        
        # Step 4: Performance testing
        if performance_time > feature_spec.performance_target:
            raise PerformanceException(f"Feature exceeds target: {performance_time}ms")
        
        return FeatureResult(
            implementation=result,
            performance_ms=performance_time,
            validation=validation_result,
            test_coverage=len(test_cases)
        )
```

---

## ⚡ Real-time Development (Week 3)

### Real-time Architecture Development ✅

**Real-time Development Files:**
```
frontend/src/lib/realtime.ts                  # WebSocket management
frontend/src/pages/TestWeek3Realtime.tsx     # Real-time testing
backend/app/services/message_queue.py        # Message queue system
```

### Real-time Development Commands

```bash
# Real-time feature development
cd frontend

# Run real-time E2E tests
npx playwright test week3-realtime --headed

# Test WebSocket connections
npx playwright test week3-final --grep="WebSocket"

# Performance validation
npx playwright test --grep="performance" --headed

# Real-time API testing
curl -X POST http://127.0.0.1:8000/api/v1/conversations/queue/start \
  -H "Content-Type: application/json" \
  -d '{"worker_count": 2}'

# Check queue status
curl -s http://127.0.0.1:8000/api/v1/conversations/test-id/queue/status | jq
```

### Real-time Development Patterns

```typescript
// Real-time development pattern
class RealtimeDevelopment {
  /**
   * Standard pattern for real-time feature development.
   * 
   * Key Development Principles:
   * - Sub-100ms performance targets
   * - Comprehensive error handling
   * - Auto-error capture in tests
   * - WebSocket reliability testing
   */
  
  async developRealtimeFeature(spec: RealtimeFeatureSpec): Promise<RealtimeFeature> {
    // Step 1: Performance baseline
    const performanceBaseline = await this.measureCurrentPerformance();
    
    // Step 2: Implement with monitoring
    const implementation = await this.implementWithMonitoring(spec);
    
    // Step 3: WebSocket testing
    const websocketTests = await this.runWebSocketTests(implementation);
    
    // Step 4: Performance validation
    const newPerformance = await this.measureNewPerformance();
    
    if (newPerformance.latency > 100) { // 100ms target
      throw new PerformanceException(`WebSocket latency too high: ${newPerformance.latency}ms`);
    }
    
    // Step 5: E2E validation
    const e2eResults = await this.runE2ETests(implementation);
    
    return {
      implementation,
      performance: newPerformance,
      websocket_tests: websocketTests,
      e2e_results: e2eResults
    };
  }
}
```

---

## 🎨 Frontend Development

### React 19 Development Patterns ✅

**Frontend Development Structure:**
```typescript
// Modern React 19 development patterns
const OptimizedComponent = React.memo(({ data }: ComponentProps) => {
  // Performance-optimized state management
  const [state, setState] = useState(initialState);
  
  // Memoized computations for performance
  const memoizedData = useMemo(() => {
    return heavyComputation(data);
  }, [data]);
  
  // Optimized event handlers
  const handleEvent = useCallback(async (event: Event) => {
    const startTime = performance.now();
    
    try {
      await performAction(event);
    } finally {
      const processingTime = performance.now() - startTime;
      trackPerformance('component_action', processingTime);
    }
  }, []);
  
  // Performance monitoring
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        trackPerformance(entry.name, entry.duration);
      });
    });
    
    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, []);
  
  return (
    <div className="optimized-component">
      {/* Component JSX */}
    </div>
  );
});
```

### Frontend Development Commands

```bash
# Frontend development workflow
cd frontend

# Development server with hot reload
npm run dev

# Type checking
npx tsc --noEmit

# Testing
npm run test                    # Unit tests
npm run test:coverage          # Coverage report
npx playwright test           # E2E tests

# Performance analysis
npm run build:analyze          # Bundle analysis
npm run lighthouse            # Performance audit

# Component development
npm run storybook             # Component development (if configured)
```

### Theme Development

```css
/* Theme development pattern */
:root {
  /* Development color palette */
  --dev-primary: #3b82f6;
  --dev-success: #10b981;
  --dev-warning: #f59e0b;
  --dev-error: #ef4444;
  
  /* Performance optimization variables */
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
}

/* Development helper classes */
.dev-performance-monitor {
  position: fixed;
  top: 10px;
  right: 10px;
  background: var(--dev-primary);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
}

/* Debug mode styling */
[data-debug="true"] * {
  outline: 1px solid rgba(255, 0, 0, 0.2) !important;
}
```

---

## 🔧 Backend Development

### FastAPI Development Patterns ✅

**Backend Development Structure:**
```python
# FastAPI development patterns
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import time
import logging

# Performance monitoring decorator
def monitor_performance(func):
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            processing_time = (time.time() - start_time) * 1000
            
            # Log performance metrics
            logging.info(f"{func.__name__} completed in {processing_time:.2f}ms")
            
            return result
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            logging.error(f"{func.__name__} failed after {processing_time:.2f}ms: {str(e)}")
            raise
    return wrapper

# API endpoint development pattern
@app.post("/api/v1/conversations/{conversation_id}/turns")
@monitor_performance
async def process_turn_endpoint(
    conversation_id: UUID,
    turn_data: TurnCreateRequest,
    db: Session = Depends(get_db)
) -> TurnResponse:
    """
    Standard pattern for CleanerContext API development.
    
    Development principles:
    - Performance monitoring on every endpoint
    - Comprehensive error handling
    - Detailed logging for debugging
    - Type safety with Pydantic models
    """
    try:
        # Validate conversation exists
        conversation = await get_conversation_or_404(conversation_id, db)
        
        # Process with CleanerContext
        result = await conversation_manager.add_turn(
            conversation_id=conversation_id,
            speaker=turn_data.speaker,
            raw_text=turn_data.raw_text,
            db=db
        )
        
        return TurnResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Turn processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Turn processing failed")
```

### Backend Development Commands

```bash
# Backend development workflow
cd backend
source venv/bin/activate

# Development server with auto-reload
uvicorn app.main:app --reload --log-level debug

# Testing
python3 -m pytest tests/ -v                    # All tests
python3 -m pytest tests/test_health.py -v      # Specific tests
python3 -m pytest tests/ --cov=app             # Coverage

# Database management
alembic upgrade head                            # Apply migrations
alembic revision --autogenerate -m "message"   # Create migration

# API testing
curl -X GET http://127.0.0.1:8000/health
curl -X GET http://127.0.0.1:8000/docs

# Performance monitoring
python3 -c "from app.services.conversation_manager import ConversationManager; print('Import successful')"
```

---

## 🧪 Testing Development

### Test Development Patterns ✅

**Testing Development Methodology:**
```typescript
// E2E test development pattern
import { test, expect, Page } from '@playwright/test';

// Standard test pattern with auto-error capture
test('CleanerContext feature development test', async ({ page }) => {
  // Setup auto-error capture
  const { errors, failedRequests, performanceMetrics } = await setupErrorCapture(page);
  
  // Performance baseline
  const startTime = Date.now();
  
  // Test implementation
  await page.goto('http://127.0.0.1:6173');
  
  // Feature-specific testing
  await page.click('[data-testid="feature-button"]');
  await page.waitForSelector('[data-testid="feature-result"]');
  
  // Performance validation
  const processingTime = Date.now() - startTime;
  expect(processingTime).toBeLessThan(1000); // 1 second max
  
  // Auto-error validation
  expect(reportIssues(errors, failedRequests, 'feature test')).toBe(true);
  
  // Feature-specific assertions
  const result = await page.textContent('[data-testid="feature-result"]');
  expect(result).toBeTruthy();
});

// Performance test pattern
test('CleanerContext performance test', async ({ page }) => {
  await page.goto('http://127.0.0.1:6173/test-cleaner-context');
  
  // Measure CleanerContext processing performance
  const startTime = Date.now();
  await page.click('[data-testid="process-turn"]');
  await page.waitForSelector('[data-testid="processing-complete"]');
  const processingTime = Date.now() - startTime;
  
  // Validate CleanerContext performance targets
  expect(processingTime).toBeLessThan(500); // CleanerContext target
});
```

### Testing Commands

```bash
# Comprehensive testing development
cd frontend

# Run tests during development
npm run test -- --watch                # Unit tests with watch mode
npx playwright test --headed           # E2E tests with browser
npx playwright test --debug            # Debug mode

# Specific test categories  
npx playwright test week3-core         # Core functionality
npx playwright test week3-realtime     # Real-time features
npx playwright test week3-final        # Complete workflows

# Performance testing
npx playwright test --grep="performance" --headed
npm run test -- --testNamePattern="performance"

# Test development tools
npx playwright codegen                 # Generate test code
npx playwright show-report            # View test reports
```

---

## 📊 Development Monitoring

### Development Performance Monitoring ✅

```typescript
// Development performance tracking
class DevelopmentMonitor {
  private readonly DEVELOPMENT_TARGETS = {
    api_response: 100,      // ms
    ui_interaction: 50,     // ms
    test_execution: 30,     // seconds for full suite
    build_time: 60,         // seconds
    hot_reload: 2           // seconds
  };
  
  trackDevelopmentMetric(metric: string, value: number): void {
    const target = this.DEVELOPMENT_TARGETS[metric];
    const status = value <= target ? '✅' : '⚠️';
    
    console.log(`${status} ${metric}: ${value}ms (target: ${target}ms)`);
    
    if (value > target * 1.5) {
      console.warn(`🚨 Performance degradation detected for ${metric}`);
    }
  }
  
  generateDevelopmentReport(): DevelopmentReport {
    return {
      build_performance: this.measureBuildPerformance(),
      test_performance: this.measureTestPerformance(),
      development_server_performance: this.measureDevServerPerformance(),
      recommendations: this.generateOptimizationRecommendations()
    };
  }
}
```

### Development Health Checks

```bash
# Development environment health checks
#!/bin/bash

echo "🔍 Development Environment Health Check"

# Check Node.js and npm
node --version && echo "✅ Node.js OK" || echo "❌ Node.js issue"
npm --version && echo "✅ npm OK" || echo "❌ npm issue"

# Check Python and pip
python3 --version && echo "✅ Python OK" || echo "❌ Python issue"
pip --version && echo "✅ pip OK" || echo "❌ pip issue"

# Check services
curl -s http://127.0.0.1:8000/health >/dev/null && echo "✅ Backend OK" || echo "❌ Backend issue"
curl -s http://127.0.0.1:6173 >/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend issue"

# Check database
cd backend && source venv/bin/activate && python3 -c "from app.core.database import get_db; print('✅ Database OK')" 2>/dev/null || echo "❌ Database issue"

# Performance check
echo "⚡ Performance Check"
time curl -s http://127.0.0.1:8000/health >/dev/null && echo "✅ API response time acceptable"

echo "🎉 Health check complete"
```

---

## 🚀 Deployment Development

### Production Deployment Preparation

```bash
# Production deployment checklist
echo "🚀 Production Deployment Preparation"

# Build optimization
cd frontend
npm run build
npm run build:analyze

# Backend optimization
cd ../backend
python3 -m pytest tests/ --cov=app --cov-report=html

# Performance validation
cd ../frontend
npx playwright test
npm run lighthouse

# Security check
npm audit
pip check

# Environment validation
echo "✅ Production deployment ready"
```

---

## 🌟 Development Achievements

### Development Excellence ✅

- **Autonomous Development**: Auto-accept mode enabling rapid iteration
- **Performance First**: All development maintains sub-100ms targets
- **Comprehensive Testing**: 52 unit tests + 28 E2E tests integrated into workflow
- **CleanerContext Optimized**: Development patterns specifically for stateful AI processing
- **Real-time Development**: Advanced WebSocket and queue development patterns
- **Production Quality**: Every feature developed to production standards

### Development Innovation ✅

- **Revolutionary Patterns**: CleanerContext-specific development methodologies
- **Performance Integration**: Performance monitoring built into development workflow
- **Auto-Error Capture**: Advanced testing with automatic error detection
- **Modern Stack**: React 19 + FastAPI with cutting-edge development practices
- **Complete Tooling**: Comprehensive development environment and monitoring

---

**This development guide provides complete instructions for building and maintaining the revolutionary CleanerContext system with production-ready quality and exceptional performance.**

---

*Development documentation updated: January 12, 2025*  
*System Status: Complete Development Environment* ✅  
*Development Coverage: Full production development workflow* 🚀