# CLAUDE.md - Lumen Transcript Cleaner Development Guide

## 🎯 Project-Specific Working Style

Hey Claude! You're working on the **Lumen Transcript Cleaner** rebuild - a sophisticated AI-powered conversation cleaning system. This developer (Scott) is a **vibe coder** who values autonomous development, sub-100ms performance, and exceptional user experience.

**Core Mission**: Build the cleanercontext.md vision from scratch using modern tech stack (Vite + React 19 + TypeScript + UnoCSS + Supabase) with test-driven development and real-time architecture.

## 🎯 PROJECT STATUS: STABLE PRODUCTION SYSTEM v1.0.0 ✅

**Current Phase**: Stable Production Release - All Features Complete  
**Documentation**: Fully updated documentation suite with 15+ comprehensive guides  
**Test Coverage**: 52 total tests (100% passing), zero known bugs  
**Performance**: All targets exceeded by 40-50% margins across all metrics

### System Achievements ✅
- ✅ **Complete Application**: Professional transcript cleaning interface in production
- ✅ **CleanerContext Integration**: Real Gemini 2.5 Flash-Lite processing with stateful intelligence
- ✅ **Real-time Architecture**: WebSocket updates with sub-100ms performance
- ✅ **Advanced Features**: Settings persistence, dark mode, error handling, developer tools
- ✅ **Production Quality**: Professional UI/UX deployed and tested in business environments
- ✅ **Comprehensive Testing**: 28 E2E tests with auto-error capture and performance validation
- ✅ **Complete Documentation**: 15+ guides covering setup, architecture, API, and operations
- ✅ **Prompt Engineering Dashboard**: Advanced developer tools for AI prompt optimization
- ✅ **Gemini Query Inspector**: Full transparency with prompt/response/timing data
- ✅ **Prompt Engineering Dashboard**: Full visibility and control over AI prompts (added Jan 8, 2025)

### Fully Operational Features 🚀
- Professional transcript upload and processing interface
- Real-time turn-by-turn display with original vs cleaned text
- Complete Gemini model parameter controls and configuration
- Automatic transcription error detection and filtering
- Settings persistence across sessions with localStorage
- Complete dark/light theme system with instant switching
- Advanced logging and developer tools with copy functionality
- Comprehensive error handling with graceful degradation
- Prompt Engineering Dashboard for AI prompt optimization
- Gemini Query Inspector with full prompt/response/timing transparency
- Prompt Engineering Dashboard for AI prompt optimization

## ⚡ Auto-Accept Mode & Autonomous Development

**CRITICAL**: This project uses auto-accept mode by default. You have broad permissions to execute commands and edit files without asking permission.

### 🚨 Important Guidelines
1. **All operations auto-execute** - Be careful and deliberate
2. **Commit frequently** - After each stable feature/fix is complete
3. **Test before committing** - Ensure changes work properly
4. **Never commit broken code** - Always verify functionality first

### 🔄 Commit Strategy & Visual Feedback
- Commit after completing each task/feature
- Use descriptive commit messages
- Include Co-Authored-By: Claude for transparency
- Run tests before committing when applicable
- **ALWAYS provide visual summary after commits** (triggers ping!)


### 🚀 Development Guidelines
1. **Work autonomously** - Make changes without asking permission
2. **Find files yourself** - Use search tools to locate what you need
3. **Complete full tasks** - Don't stop halfway
4. **Test thoroughly** - Verify changes work before reporting completion
5. **Commit often** - After each stable feature or fix

## 🔔 Ping Sound Notifications

**CRITICAL RULE**: Ping EVERY TIME you finish work and pass the baton back to the user.

```bash
afplay /System/Library/Sounds/Ping.aiff
```

**When to ping:**
- ✅ **ALWAYS** when you finish ANY task and stop working
- ✅ When you complete what was asked and await next instructions
- ✅ When you need user input/decision to continue
- ✅ After fixing an error and the system is ready
- ✅ When presenting results/options and waiting for response

**When NOT to ping:**
- ❌ During work-in-progress
- ❌ While actively debugging/coding
- ❌ When you're about to continue with more work
- ❌ Mid-task or between related operations

**Simple rule**: If you're done working and waiting for user = PING!

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

### Development URLs
- **Frontend**: http://127.0.0.1:6173
- **Backend API**: http://127.0.0.1:8000
- **API Docs**: http://127.0.0.1:8000/docs
- **Prompt Dashboard**: http://127.0.0.1:6173/prompt-engineering

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

### ⚡ CRITICAL: Server & Command Timeout Optimization

**MANDATORY**: NEVER wait 120+ seconds for commands that complete quickly. Use appropriate timeouts:

#### Server Startup Commands (20s max)
```bash
# Frontend servers
npm run dev                    # timeout: 20000 (expect "ready in XXXms" ~15s)
yarn dev                       # timeout: 20000
pnpm dev                       # timeout: 20000
vite                          # timeout: 20000

# Backend servers
uvicorn app.main:app --reload  # timeout: 20000 (expect "Uvicorn running" ~10s)
fastapi dev                   # timeout: 20000
python -m flask run           # timeout: 20000
node server.js                # timeout: 20000

# Database servers
supabase start                # timeout: 20000
docker-compose up             # timeout: 20000
```

#### Quick Commands (10s max)
```bash
# Package managers
npm install                   # timeout: 10000
pip install                   # timeout: 10000
yarn install                  # timeout: 10000

# Build commands
npm run build                 # timeout: 10000
npm run test                  # timeout: 10000
pytest                        # timeout: 10000

# Git operations
git status                    # timeout: 10000
git commit                    # timeout: 10000
git push                      # timeout: 10000
```

#### Success Indicators - Stop Waiting When You See:
- **Vite**: "ready in XXXms" or "Local: http://..."
- **FastAPI**: "Uvicorn running on http://..." or "Application startup complete"
- **React**: "webpack compiled" or "Local: http://..."
- **Tests**: "X passing" or "All tests passed"
- **Install**: "added X packages" or "Successfully installed"

#### Implementation Rule:
**ALWAYS** specify timeout parameter in Bash tool calls for these commands:
```typescript
// Example
Bash({
  command: "npm run dev",
  timeout: 20000,  // 20 seconds max
  description: "Start frontend dev server"
})
```

**NEVER** wait for default 120s timeout on development commands. This wastes 100+ seconds every time.

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

### Quick Server Startup
```bash
# From project root:
cd frontend && npm run dev &
cd ../backend && source venv/bin/activate && uvicorn app.main:app --reload &

# Access URLs:
# Frontend: http://127.0.0.1:6173 (or 6174 if auto-selected)
# Backend API: http://127.0.0.1:8000
# API Docs: http://127.0.0.1:8000/docs
# Prompt Dashboard: http://127.0.0.1:6173/prompt-engineering
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

### **🎯 Playwright Testing Protocol - CRITICAL**

**MANDATORY**: For all new features, Claude MUST:

1. **ALWAYS test with Playwright in headless mode (`headless: true`)**
2. **NEVER show browser on user's screen**
3. **Take screenshots to verify UI appearance**
4. **Check for common UI/UX mistakes:**
   - Dark text on dark background
   - Light text on light background
   - Missing hover states
   - Broken layouts
   - Inaccessible buttons
   - Theme inheritance issues

5. **Test Flow Template**:
```javascript
test('feature name - full UI/UX validation', async ({ page }) => {
  const browser = await p.chromium.launch({ headless: true }); // ALWAYS headless
  
  // Test light mode
  await page.goto('http://localhost:6173');
  await page.screenshot({ path: 'light-mode-test.png' });
  
  // Test dark mode
  await page.click('button[aria-label="Toggle dark mode"]');
  await page.screenshot({ path: 'dark-mode-test.png' });
  
  // Verify no UI/UX issues
  // - Check text contrast
  // - Verify interactive elements
  // - Test responsive behavior
});
```

6. **Only tell user to look at feature when:**
   - All Playwright tests pass
   - Screenshots confirm good UI/UX
   - No dark-on-dark or light-on-light issues
   - Feature works correctly in both themes



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

### 🎯 MANDATORY: Visual Summary After Every Task
**THIS TRIGGERS THE PING!** Always provide this format when done:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED: [Concise summary with emojis]
   - 🔧 [What was fixed/built]
   - 📝 [Any commits made]
   - 🚀 [Current status]

🎯 READY: [System state / Next options]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Remember**: Visual summary = Work done = PING TIME! 🔔

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

## 🔒 Supabase Security & Project ID Validation

### **CRITICAL: Read-Only vs Write Operations**

**Auto-Approved (Read-Only Operations)**:
- `mcp__supabase__list_*` - All listing operations
- `mcp__supabase__get_*` - All getter operations  
- `mcp__supabase__search_docs` - Documentation search
- `mcp__supabase__generate_typescript_types` - Type generation
- `Bash(supabase status)` - Status checks
- `Bash(supabase logs*)` - Log viewing

**Requires Manual Approval (Write/Destructive Operations)**:
- `mcp__supabase__apply_migration` - Database schema changes
- `mcp__supabase__execute_sql` - Direct SQL execution
- `mcp__supabase__create_branch` - Branch creation
- `mcp__supabase__delete_branch` - Branch deletion
- `mcp__supabase__merge_branch` - Branch merging
- `mcp__supabase__reset_branch` - Branch reset
- `mcp__supabase__rebase_branch` - Branch rebase
- `mcp__supabase__deploy_edge_function` - Function deployment

### **Mandatory Project ID Verification**

**BEFORE any write operation, Claude MUST:**

1. **Get current project info:**
   ```bash
   mcp__supabase__get_project_url
   ```

2. **Verify project identity:**
   - Confirm project name matches: "Lumen Transcript Cleaner"
   - Confirm project URL contains expected identifier
   - Display project info to user for confirmation

3. **Request explicit approval:**
   ```
   🚨 SUPABASE WRITE OPERATION REQUESTED
   Project: [Project Name]
   URL: [Project URL] 
   Operation: [Specific operation requested]
   
   Are you sure you want to proceed with this operation? (y/N)
   ```

4. **Only proceed after explicit "yes" confirmation**

### **Example Verification Flow:**
```typescript
// REQUIRED before any write operation
async function verifyProjectBeforeWrite(operation: string) {
  const projectUrl = await mcp__supabase__get_project_url();
  const projectInfo = await mcp__supabase__list_tables(); // Verify connection
  
  console.log(`
🚨 SUPABASE WRITE OPERATION: ${operation}
Project URL: ${projectUrl}
Connected to: ${projectInfo ? 'Lumen Transcript Cleaner' : 'Unknown'}

CONFIRM: Are you sure you want to proceed? (y/N)
  `);
  
  // Wait for user confirmation before proceeding
}
```

**Security Notes:**
- Never assume project context without verification
- Always display project info before write operations  
- Treat all SQL execution and migrations as high-risk
- Read operations can proceed without confirmation for development efficiency

## 🎯 Quality Standards

- **Test Coverage**: >95% for critical paths
- **Performance**: Sub-100ms UI feedback, <500ms processing
- **Security**: Zero critical vulnerabilities
- **Code Quality**: Clean, maintainable, well-documented
- **Accessibility**: WCAG 2.1 AA compliance

## 📚 Comprehensive Documentation

**Documentation**: Complete guides in `/docs` folder
- [Setup Guide](./docs/SETUP.md): Installation and configuration
- [Architecture Overview](./docs/ARCHITECTURE.md): System design
- [API Documentation](./docs/API.md): REST API reference
- [Testing Guide](./docs/TESTING.md): Testing strategy
- [Troubleshooting](./docs/TROUBLESHOOTING.md): Common issues
- [Prompt Engineering Dashboard](./docs/PROMPT-ENGINEERING-DASHBOARD.md): Latest feature

## 🚀 GitHub Repository

**Repository**: https://github.com/scotty-git/sidelinescott

### Repository Structure
```
sidelinescott/
├── frontend/          # React 19 + TypeScript frontend
├── backend/           # FastAPI + Python backend
├── docs/              # Comprehensive documentation
├── examplescripts/    # Ready-to-use transcript examples
├── CLAUDE.md          # This development guide
└── README.md          # Project overview
```

### Quick Clone & Setup
```bash
# Clone the repository
git clone https://github.com/scotty-git/sidelinescott.git
cd sidelinescott

# Frontend setup
cd frontend && npm install && npm run dev

# Backend setup (new terminal)
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload
```

### Contributing
- **Main Branch**: `main` (production-ready code)
- **Development**: Create feature branches from `main`
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Pull Requests**: All changes should go through PR review

### Repository Features
- ✅ **Complete Codebase**: Production-ready CleanerContext system
- ✅ **Comprehensive Tests**: 52 unit tests + 28 E2E tests with Playwright
- ✅ **Full Documentation**: Complete guides for setup, development, and deployment
- ✅ **Example Content**: Ready-to-use transcript examples for testing
- ✅ **Development Tools**: VS Code settings, linting, formatting configurations

---

This guide ensures Claude works autonomously while building the cleanercontext.md vision with exceptional quality, performance, and user experience. The complete project is now available on GitHub for collaboration and deployment.