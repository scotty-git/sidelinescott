# CLAUDE.md - Lumen Transcript Cleaner Development Guide

## 🎯 Project Overview

**Lumen Transcript Cleaner** - AI-powered conversation cleaning system for Scott (vibe coder). Focus: autonomous development, sub-100ms performance, exceptional UX.

**Tech Stack**: Vite + React 19 + TypeScript + UnoCSS + Supabase + FastAPI + Gemini 2.5 Flash-Lite

**Status**: Stable Production v1.0.0 ✅ (52 tests passing, full feature set deployed)

## ⚡ Auto-Execute Mode

**CRITICAL**: Auto-accept enabled. Execute commands/edits without asking permission.

**Guidelines**:
- Commit after stable features/fixes
- Test before committing
- Never commit broken code
- Visual summary after commits (triggers ping!)

## 🚀 Quick Commands

**Dev Servers**:
```bash
# Frontend: npm run dev (timeout: 20000)
# Backend: uvicorn app.main:app --reload (timeout: 20000)
# Health: ./check-health.sh
```

**URLs**:
- Frontend: http://127.0.0.1:6173
- Backend: http://127.0.0.1:8000
- API Docs: http://127.0.0.1:8000/docs
- Prompt Dashboard: http://127.0.0.1:6173/prompt-engineering

**Testing**:
- Unit: `npm run test` (must pass 100% first)
- E2E: `npm run test:e2e` (headless only)
- Backend: `pytest tests/`

## 🤖 AI Model (MANDATORY)

**REQUIRED**: `gemini-2.5-flash-lite-preview-06-17` ONLY
- Most cost-efficient, 1.5x faster than Gemini 2.0
- Temperature: 0.1, JSON output, 1M context window
- Never use: gemini-pro, gemini-flash, gemini-2.5-flash

## 🧠 CleanerContext Core

**Requirements**:
1. Stateful cleaning with sliding window
2. Skip Lumen turns (zero processing)
3. JSON output with confidence scores
4. Sub-100ms UI feedback via WebSockets
5. Intelligent none/light/full decisions

**Performance Targets**:
- UI feedback: 50ms
- WebSocket updates: 100ms
- User turn processing: 500ms
- Lumen bypass: 10ms

## 🔒 Database Security

**MANDATORY**: READ-ONLY ACCESS ONLY. Never perform write operations without explicit permission.

**Access Method**: 
- Primary: Direct API (`curl -H "Authorization: Bearer [KEY]" "https://geyfjyrgqykzdnvjetba.supabase.co/rest/v1/table"`)
- Fallback: MCP tools if available

**Auto-Approved**: GET requests, list operations, schema queries
**Requires Permission**: POST/PATCH/DELETE, SQL execution, migrations

**Write Request Process**:
1. Stop and ask: "🚨 WRITE OPERATION: [operation]. Scott, proceed? (y/N)"
2. Wait for explicit "yes"
3. If "no" or unclear: provide exact command for Scott to run

## 📋 TodoWrite

**Use for**: Multi-step features (3+ steps), multiple tasks, major milestones
**Pattern**: Mark in_progress before starting, completed immediately after finishing

## 🧪 Testing Protocol

**Mandatory Sequence**:
1. Unit tests (100% pass required)
2. E2E tests (headless only, auto-error capture)
3. Manual testing (only when all automated pass)

**Playwright**: Always headless, screenshot verification, UI/UX validation

## 🔄 Git Workflow

**Commit Strategy**: After major features, descriptive messages with Co-Authored-By: Claude
**Format**: `feat: [description]` with bullet points and Claude attribution

## 🔐 Authentication

**Single Admin**: `eval@lumenarc.ai` / `@Evalaccount1`
**Access**: Full system access, no registration needed

## 📊 Visual Summary Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED: [summary]
   - 🔧 [what was built/fixed]
   - 📝 [commits made]
   - 🚀 [current status]

🎯 READY: [next actions]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📚 Extended Documentation

**Details**: See `/docs` folder for comprehensive guides
- Setup: `/docs/SETUP.md`
- Architecture: `/docs/ARCHITECTURE.md`
- API: `/docs/API.md`
- Testing: `/docs/TESTING.md`
- Performance: `/docs/PERFORMANCE.md`
- Security: `/docs/SECURITY.md`

## 🚀 Repository

**GitHub**: https://github.com/scotty-git/sidelinescott
**Branch Strategy**: Feature branches from `main`
**Amir's Version**: Use `CLAUDE-Amir.md` (swap: `mv CLAUDE-Amir.md CLAUDE.md`)

---

*Optimized for token efficiency while maintaining all essential project context and security protocols.*