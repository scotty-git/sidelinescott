#!/bin/bash

# Lumen Transcript Cleaner - Health Check Script
echo "🎯 Lumen Transcript Cleaner - Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Frontend health check
echo "🖼️  Checking Frontend (http://127.0.0.1:6173)..."
if curl -s http://127.0.0.1:6173 > /dev/null; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: Not responding"
fi

# Backend health check  
echo "🚀 Checking Backend (http://127.0.0.1:8000)..."
if HEALTH=$(curl -s http://127.0.0.1:8000/health); then
    echo "✅ Backend: OK"
    echo "   Status: $(echo $HEALTH | jq -r '.status' 2>/dev/null || echo 'healthy')"
else
    echo "❌ Backend: Not responding"
fi

# API documentation check
echo "📚 Checking API Docs (http://127.0.0.1:8000/docs)..."
if curl -s http://127.0.0.1:8000/docs > /dev/null; then
    echo "✅ API Docs: Available"
else
    echo "❌ API Docs: Not available"
fi

echo ""
echo "📍 Quick Access URLs:"
echo "   Frontend: http://127.0.0.1:6173"
echo "   Backend:  http://127.0.0.1:8000"
echo "   API Docs: http://127.0.0.1:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"