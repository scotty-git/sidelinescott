from fastapi import APIRouter

api_router = APIRouter()

# Import and include route modules
from . import health, auth, conversations, prompt_engineering

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(prompt_engineering.router, prefix="/prompt-engineering", tags=["prompt-engineering"])

# NOTE: turns.py endpoints have been moved to conversations.py to fix routing conflicts
# The /{conversation_id}/turns endpoint is now available at /api/v1/conversations/{id}/turns