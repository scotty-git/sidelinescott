import pytest
import asyncio
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db, Base
from app.core.auth import AuthManager

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db_session):
    """Create a test client that uses the test database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture
def auth_manager():
    """Create an AuthManager instance for testing."""
    return AuthManager()

@pytest.fixture
def test_user_data():
    """Test user data."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "test@example.com",
        "created_at": "2025-01-07T00:00:00Z",
        "is_active": True
    }

@pytest.fixture
def test_conversation_data():
    """Test conversation data."""
    return {
        "name": "Test Conversation",
        "description": "A test conversation for unit testing",
        "metadata": {"test": True}
    }

@pytest.fixture
def test_turn_data():
    """Test turn data."""
    return {
        "speaker": "User",
        "raw_text": "I'm the vector of Marketing",
        "cleaned_text": "I'm the Director of Marketing",
        "confidence_score": "HIGH",
        "cleaning_applied": True,
        "cleaning_level": "full",
        "processing_time_ms": 250,
        "corrections": [
            {
                "original": "vector of",
                "corrected": "Director of", 
                "confidence": "HIGH",
                "reason": "contextual_understanding"
            }
        ],
        "context_detected": "identity_discussion",
        "ai_model_used": "gemini-pro"
    }