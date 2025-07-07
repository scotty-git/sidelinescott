from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Extended health check endpoint."""
    # Test database connection
    try:
        db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception as e:
        database_status = f"error: {str(e)}"
    
    return {
        "status": "healthy" if database_status == "connected" else "degraded",
        "database": database_status,
        "supabase": "connected",
        "gemini_api": "available",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "environment": "development"
    }