from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import api_router

app = FastAPI(
    title="Lumen Transcript Cleaner API",
    description="AI-powered conversation cleaning system",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:6173", "http://localhost:6173", "http://127.0.0.1:6174", "http://localhost:6174", "http://127.0.0.1:6175", "http://localhost:6175"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include the main API router with all sub-routers
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Lumen Transcript Cleaner API", 
        "version": "1.0.0",
        "status": "active"
    }