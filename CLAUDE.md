# CLAUDE.md - Lumen Transcript Cleaner Development Guide

## 🎯 Project-Specific Working Style

Hey Claude! You're working on the **Lumen Transcript Cleaner** rebuild - a sophisticated AI-powered conversation cleaning system. This developer (Scott) is a **vibe coder** who values autonomous development, sub-100ms performance, and exceptional user experience.

**Core Mission**: Build the cleanercontext.md vision from scratch using modern tech stack (Vite + React 19 + TypeScript + UnoCSS + Supabase) with test-driven development and real-time architecture.

## 🎯 PROJECT STATUS: FULLY OPERATIONAL SYSTEM ✅

**Current Phase**: Production-Ready Transcript Cleaner - Complete Implementation  
**Documentation**: Comprehensive documentation updated for all features  
**Test Coverage**: 52 total tests (100% passing), comprehensive E2E coverage  
**Performance**: All targets exceeded by 40%+ margins across all features

### System Achievements ✅
- ✅ **Complete Application**: Professional transcript cleaning interface operational
- ✅ **CleanerContext Integration**: Real Gemini 2.5 Flash-Lite processing with stateful intelligence
- ✅ **Real-time Architecture**: WebSocket updates with sub-100ms performance
- ✅ **Advanced Features**: Settings persistence, dark mode, error handling, developer tools
- ✅ **Production Quality**: Professional UI/UX suitable for business deployment
- ✅ **Comprehensive Testing**: 28 E2E tests with auto-error capture and performance validation
- ✅ **Complete Documentation**: All guides updated to reflect actual system capabilities

### Fully Operational Features 🚀
- Professional transcript upload and processing interface
- Real-time turn-by-turn display with original vs cleaned text
- Complete Gemini model parameter controls and configuration
- Automatic transcription error detection and filtering
- Settings persistence across sessions with localStorage
- Complete dark/light theme system with instant switching
- Advanced logging and developer tools with copy functionality
- Comprehensive error handling with graceful degradation

## ⚡ Auto-Accept Mode & Autonomous Development

**CRITICAL**: This project uses auto-accept mode by default. You have broad permissions to execute commands and edit files without asking permission.

### 🔧 Claude Code Permission System Architecture

Claude Code uses a **two-tier permission system** with global and project-specific settings:

#### **Global Permissions** (System-wide)
**Location**: `~/.claude/settings.json`
- **Scope**: Applies to ALL projects on this machine
- **Permission Type**: `"allow"` array (requires approval per use)
- **Purpose**: Base permissions for general development work
- **Security**: Safer default - requires confirmation for each use

#### **Project Permissions** (This project only)
**Location**: `/Users/calsmith/Documents/VS/sidelinescott/.claude/settings.local.json`
- **Scope**: Only applies to this specific project
- **Permission Type**: `"auto_approve"` array (no approval needed)
- **Purpose**: High-performance autonomous development
- **Security**: More permissive - immediate execution

#### **Precedence Rules**
- **Project settings override global settings**
- If tool is in project `auto_approve` → executes immediately
- If tool is only in global `allow` → requires approval
- If tool is in neither → blocked entirely

#### **Quick Permission File Access**
```bash
# Edit global permissions (affects all projects)
code ~/.claude/settings.json

# Edit project permissions (this project only)
code /Users/calsmith/Documents/VS/sidelinescott/.claude/settings.local.json

# Check current permissions
claude config list
```

### 🔧 Current Project Auto-Approved Operations
This project has **265+ auto-approved operations** including:
- **Development Tools**: npm, node, python, uvicorn, git, github cli
- **File Operations**: rm, mv, cp, mkdir, find, touch, cat
- **System Tools**: ps, kill, lsof, curl, wget, ping
- **Package Managers**: npm, pip, yarn, pnpm, bun
- **Database**: supabase, psql, alembic commands
- **Testing**: pytest, vitest, playwright
- **Deployment**: vercel, docker commands
- **All Core Claude Tools**: Read, Write, Edit, MultiEdit, Glob, Grep, LS

**Note**: Plan mode (`exit_plan_mode`) is intentionally **NOT** auto-approved to ensure you review implementation plans before execution.

### 🚀 Autonomous Mode Guidelines
1. **Never ask permission to edit files** - Just do it
2. **Don't ask which file to edit** - Find it yourself using search tools
3. **Don't confirm before making changes** - Make changes and report when done
4. **Don't ask for clarification on obvious things** - Make reasonable assumptions
5. **Batch operations** - Do multiple related edits without asking between each
6. **Complete entire tasks** - Don't stop halfway to ask if you should continue
7. **Execute bash commands directly** - Auto-accept handles permissions

## 🔔 Ping Sound Notifications

**Setup ping notification:**
```bash
# Ping sound is already configured with ~/claude-notify.sh
~/claude-notify.sh  # Or use direct afplay command
afplay /System/Library/Sounds/Ping.aiff
```

**When to ping:**
- ✅ When you finish a complete task and are waiting for next instructions
- ✅ When you need user input to proceed with next phase
- ✅ After completing major milestones (Week 1 foundation complete, etc.)
- ✅ When presenting options/choices and need user decision

**When NOT to ping:**
- ❌ During progress updates or while working
- ❌ When you're about to continue with more work
- ❌ Before asking questions (ask first, then ping)

## 🏗️ Project Architecture & Tech Stack

### Core Technologies
```bash
# Frontend
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install @supabase/supabase-js zustand react-router-dom
npm install -D @unocss/vite unocss @types/node
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip3 install fastapi uvicorn sqlalchemy alembic asyncpg supabase redis
pip3 install python-multipart python-jose[cryptography] pytest pytest-asyncio httpx
```

### Development Environment ✅ OPERATIONAL
- **Frontend**: http://127.0.0.1:6173 (Vite dev server) ✅ 
- **Backend**: http://127.0.0.1:8000 (FastAPI with uvicorn) ✅
- **API Docs**: http://127.0.0.1:8000/docs (Auto-generated OpenAPI docs) ✅
- **Database**: Supabase PostgreSQL with real-time subscriptions ✅

### Key Development Commands
```bash
# Frontend development
npm run dev                    # Start Vite dev server
npm run test:unit             # Run unit tests with Vitest
npm run test:e2e              # Run Playwright E2E tests
npm run build                 # Build for production

# Backend development
uvicorn main:app --host 127.0.0.1 --port 8000 --reload  # Start FastAPI
pytest tests/                # Run Python tests
alembic upgrade head          # Apply database migrations
python -c "from app.core.config import settings; print(settings)"  # Test config

# Health checks
./check-health.sh            # Check all services are running
curl http://127.0.0.1:8000/health  # Backend health check
curl http://127.0.0.1:5173         # Frontend health check
```

## 🤖 AI Model Specifications - CRITICAL

### **MANDATORY: Gemini 2.5 Flash-Lite Only**

**CRITICAL REQUIREMENT**: You MUST ALWAYS use **Gemini 2.5 Flash-Lite** for all AI processing. This is non-negotiable per Scott's explicit requirements.

#### **Exact Model Specification**
```python
# REQUIRED MODEL NAME - Use this exact string:
MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"

# Alternative fallback only if above fails:
FALLBACK_MODEL = "gemini-2.5-flash-lite"
```

#### **Key Gemini 2.5 Flash-Lite Features**
- **Most Cost-Efficient**: Google's most cost-effective Gemini 2.5 model
- **Optimized for Speed**: 1.5x faster than Gemini 2.0 Flash
- **Low Latency**: Ideal for high-volume, latency-sensitive applications
- **Advanced Capabilities**: Full multimodal input, 1M token context length
- **Thinking Mode**: Optional reasoning capabilities (off by default for speed)
- **Tool Integration**: Supports Google Search, code execution, function calling

#### **Performance Characteristics**
- **Target Use Cases**: Translation, classification, intelligent routing, conversation cleaning
- **Context Window**: 1 million tokens
- **Speed Optimization**: Optimized for cost and latency-sensitive operations
- **Quality**: Higher performance than Gemini 2.0 Flash-Lite across coding, math, science, reasoning

#### **API Configuration**
```python
# Required initialization
import google.generativeai as genai

genai.configure(api_key=settings.GEMINI_API_KEY)

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite-preview-06-17",
    generation_config={
        "temperature": 0.1,  # Low temperature for consistent cleaning
        "top_p": 0.8,
        "top_k": 40,
        "max_output_tokens": 2048,
        "response_mime_type": "application/json",
    },
    safety_settings={
        # Configure as needed for conversation content
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }
)
```

#### **Implementation Notes**
- **Never use**: `gemini-pro`, `gemini-flash`, `gemini-2.5-flash` (more expensive)
- **Always verify**: Model name is exactly `gemini-2.5-flash-lite-preview-06-17`
- **Cost Control**: Flash-Lite is specifically chosen for high-volume transcript processing
- **Performance**: Ideal for CleanerContext's sub-500ms processing targets

#### **Availability & Access**
- **Status**: Public Preview (as of 2025)
- **Platforms**: Google AI Studio, Vertex AI, Gemini API
- **Pricing**: Preview pricing - most cost-efficient in Gemini 2.5 family
- **Global Endpoint**: Only global endpoint supported in preview

## 🧠 CleanerContext Implementation Focus

### Core Requirements from cleanercontext.md
1. **Stateful Cleaning**: Use cleaned history in sliding window context
2. **User-Turn-Only Processing**: Skip Lumen turns (they're perfect)
3. **JSON Output Format**: Exact specification with confidence scores
4. **Real-time Processing**: Sub-100ms UI feedback via WebSockets
5. **Intelligent Decision Engine**: none/light/full cleaning decisions
6. **Self-Correcting System**: Learn from user corrections

### Key Implementation Patterns
```typescript
// Stateful conversation management
class ConversationManager {
  async addTurn(raw: Turn): Promise<CleanedTurn> {
    if (raw.speaker === 'Lumen') {
      return this.passthrough(raw); // Zero processing time
    }
    
    const cleanedHistory = this.getCleanedSlidingWindow();
    return await this.cleanUserTurn(raw, cleanedHistory);
  }
}

// JSON output format compliance
interface CleanerResponse {
  cleaned_text: string;
  metadata: {
    confidence_score: 'HIGH' | 'MEDIUM' | 'LOW';
    cleaning_applied: boolean;
    cleaning_level: 'none' | 'light' | 'full';
    corrections: Correction[];
    context_detected: string;
    processing_time_ms: number;
  };
}
```

## 📋 TodoWrite Usage Guidelines

**Use TodoWrite for:**
- Complex multi-step features (3+ steps)
- When user provides multiple tasks
- Major development phases (Week 1 foundation, Week 2 core, etc.)
- Before starting work on any planned milestone

**TodoWrite Pattern:**
```typescript
// At start of complex task
TodoWrite([
  { content: "Set up development environment", status: "pending", priority: "high" },
  { content: "Implement CleanerContext core logic", status: "pending", priority: "high" },
  { content: "Build real-time WebSocket system", status: "pending", priority: "medium" }
]);

// Mark in_progress before starting work
// Mark completed immediately after finishing each task
```

## ⚡ Performance Excellence Standards

### Sub-100ms Targets
```typescript
interface PerformanceTargets {
  ui_feedback: 50;              // Button clicks, hover effects
  api_status_check: 50;         // GET /conversation/status
  form_validation: 100;         // Form validation display
  websocket_update: 100;        // Real-time UI updates
  lumen_processing: 10;         // Lumen turn bypass
  user_turn_processing: 500;    // Full user turn with AI
}
```

### Development Server Optimization
```bash
# Start servers efficiently
npm run dev > /dev/null 2>&1 &  # Frontend in background
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &  # Backend in background

# Always provide clickable URLs
echo "✨ Frontend: http://127.0.0.1:5173"
echo "🚀 Backend API: http://127.0.0.1:8000"
echo "📚 API Docs: http://127.0.0.1:8000/docs"
```

## 🧪 Test-Driven Development & Automated QA

### **CRITICAL: Automated Testing Workflow**

**MANDATORY SEQUENCE** - Follow this exact order for every feature:

#### **Phase 1: Fast Unit Tests First** ⚡ (Always)
```bash
npm run test              # Vitest unit tests (sub-second)
npm run test:coverage     # Ensure >95% coverage
pytest tests/            # Backend unit tests
```
**Requirements**: MUST pass 100% before proceeding to Phase 2

#### **Phase 2: Playwright E2E Integration** 🤖 (Auto-run when Phase 1 passes)
```bash
npm run test:e2e         # Playwright full-app testing
```

**CRITICAL PLAYWRIGHT SETUP**: After implementing any feature, Claude MUST:
1. **Write Playwright test with error detection**:
   ```javascript
   test('feature with auto-error-capture', async ({ page }) => {
     // Auto-capture console errors
     const errors = [];
     page.on('console', msg => {
       if (msg.type() === 'error') errors.push(msg.text());
     });
     
     // Auto-capture network failures
     const failedRequests = [];
     page.on('response', response => {
       if (!response.ok()) failedRequests.push({
         url: response.url(), status: response.status()
       });
     });
     
     // Your actual test flow here
     await page.goto('http://localhost:3000');
     // ... test steps ...
     
     // Auto-report issues to Claude
     if (errors.length || failedRequests.length) {
       console.log('🚨 Auto-detected issues:', { errors, failedRequests });
     }
   });
   ```

2. **Run test immediately after implementation**
3. **Auto-capture and fix any errors without asking user**
4. **Only proceed when all tests pass**

#### **Phase 3: Manual Testing** 👤 (Only when everything is healthy)
**ONLY ASK FOR MANUAL TESTING WHEN:**
- ✅ All unit tests pass (100%)
- ✅ All Playwright E2E tests pass (100%) 
- ✅ No console errors detected
- ✅ No network request failures
- ✅ Performance targets met

**Manual Testing Request Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL AUTOMATED TESTS PASSING
   - Unit tests: 18/18 passing 
   - E2E tests: 5/5 passing
   - No console errors detected
   - Performance targets met

🎯 READY FOR MANUAL TESTING
   Please test: [specific feature/flow to manually verify]
   URLs: http://localhost:3000 | http://localhost:8000/docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **No More Copy-Paste Debugging** 🚫
- Playwright automatically captures console errors
- Auto-captures network failures 
- Auto-generates screenshots/videos on failures
- Claude receives full error context automatically
- **NEVER ask user to copy-paste errors from browser console**

### Quality Gates
- **Week 1**: Foundation tests pass, auth works, basic API functional ✅ **COMPLETE**
- **Week 2**: CleanerContext tests pass, JSON compliance, performance targets 🎯 **NEXT**
- **Week 3**: Real-time tests pass, UI meets standards, self-correction works
- **Week 4**: All tests pass, production deployment, documentation complete

## 🔄 Git Workflow & Commits

### Proactive Commit Strategy
**Suggest commits when:**
- Major feature complete
- After completing planned milestones
- Before switching development contexts
- After documentation updates

### Commit Message Format
```bash
git commit -m "$(cat <<'EOF'
feat: implement CleanerContext stateful cleaning

- Add ConversationManager with cleaned history tracking
- Implement sliding window with cleaned context
- Add zero-latency Lumen turn bypass
- Include confidence-based decision engine

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## 🌊 Real-time Architecture

### WebSocket Integration
```typescript
// Supabase real-time manager
class SupabaseRealtimeManager {
  subscribeToConversation(conversationId: string) {
    return this.supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'turns'
      }, this.handleTurnUpdate)
      .subscribe();
  }
}
```

### Message Queue System
```python
# Redis FIFO queue for cleaning jobs
class MessageQueueManager:
    async def process_cleaning_job(self, job: CleaningJob):
        if job.speaker in ['AI', 'Lumen']:
            return await self.process_lumen_turn(job)  # <10ms
        else:
            return await self.process_user_turn(job)   # <500ms
```

## 🎨 Design System Excellence

### UnoCSS Configuration
```typescript
// uno.config.ts
export default defineConfig({
  theme: {
    colors: {
      primary: '#3B82F6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444'
    },
    spacing: {
      '100ms': '100ms',  // For transition timings
    }
  },
  shortcuts: {
    'btn-primary': 'bg-primary text-white px-4 py-2 rounded transition-all duration-100 hover:scale-105 active:scale-95',
    'feedback-immediate': 'transition-all duration-50'  // Sub-50ms feedback
  }
})
```

### Reconnaissance-First Development
1. **Research existing patterns** before building new components
2. **Progressive disclosure** - reveal complexity gradually
3. **Consistent interaction patterns** across all components
4. **Accessibility first** - WCAG 2.1 AA compliance
5. **Performance optimization** - sub-100ms all interactions

## 🔍 Debugging & Development Tools

### Health Check System
```bash
# Use existing health check script
./check-health.sh

# Manual health checks
curl -s http://127.0.0.1:8000/health | jq  # Backend
curl -s http://127.0.0.1:6173 > /dev/null && echo "Frontend OK"  # Frontend
```

### Development Logging
```python
# Backend logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Frontend logging
console.log('[CleanerContext]', 'Processing turn:', turnData);
```

## 🚨 Error Handling & Recovery

### Graceful Degradation
```typescript
// Frontend error boundaries
class CleanerContextErrorBoundary extends React.Component {
  handleError(error: Error) {
    // Graceful fallback to manual cleaning mode
    this.setState({ fallbackMode: true });
    toast.error('Switching to manual mode due to processing error');
  }
}

// Backend error recovery
async def handle_cleaning_error(job: CleaningJob, error: Exception):
    if job.retry_count < 3:
        await schedule_retry(job, exponential_backoff(job.retry_count))
    else:
        await fallback_to_passthrough(job)
```

## 📊 Development Workflow

### End of Turn Format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED: [What was accomplished]
   - [Key achievement 1]
   - [Key achievement 2]
   - [Any commits made]

🎯 NEED FROM YOU: [Specific ask or "Nothing - ready for next phase!"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Smart Session Management
- Context auto-condenses - no need to suggest new sessions
- Only suggest new session if genuine performance degradation
- User prefers continuous workflow in same session

## 🔐 Master Admin Authentication System

**Single-User Configuration**: The system is designed for one master admin user:
- **User**: `eval@lumenarc.ai`
- **Password**: `@Evalaccount1`
- **Access Level**: Full access to all conversations and system features
- **Authentication**: Supabase JWT integration with simplified auth flow

**Implementation Notes**:
- No user registration system needed
- All conversations accessible to master admin
- Authentication simplified for single-user scenario
- Row-level security prepared but bypassed for master admin

## 🎯 Success Metrics

### Technical KPIs
- **Test Coverage**: >95% for all critical paths ✅ **Week 1: 75% achieved**
- **Performance**: All sub-100ms targets met ✅ **Week 1: Basic targets met**
- **CleanerContext Compliance**: 100% specification implemented 🎯 **Week 2 Target**
- **Real-time Responsiveness**: <100ms WebSocket updates 🔄 **Week 3**
- **Processing Efficiency**: <10ms Lumen turns, <500ms user turns 🔄 **Week 2**

### Quality Standards
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: Zero critical vulnerabilities ✅ **Week 1: Achieved**
- **Code Quality**: Clean, maintainable, well-documented ✅ **Week 1: Achieved**
- **User Experience**: Exceptional, intuitive, responsive ✅ **Week 1: Foundation ready**

## 📚 Comprehensive Documentation

**New `/docs` Folder**: Complete application documentation for vibe coders
- [Setup Guide](./docs/SETUP.md): Detailed installation and configuration
- [Architecture Overview](./docs/ARCHITECTURE.md): System design and decisions
- [Week 1 Completion](./docs/WEEK-1-COMPLETION.md): Achievements and status
- [API Documentation](./docs/API.md): REST API reference (auto-generated)
- [Testing Guide](./docs/TESTING.md): Comprehensive testing strategy
- [Troubleshooting](./docs/TROUBLESHOOTING.md): Common issues and solutions

---

This guide ensures Claude works autonomously while building the cleanercontext.md vision with exceptional quality, performance, and user experience. Follow the 4-week roadmap in DEVELOPMENT_ROADMAP.md for implementation details.