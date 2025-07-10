"""Test conversation model for storing prompt engineering test scenarios."""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, String, Text, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.core.database import Base


class TestConversation(Base):
    """Model for test conversations used in prompt engineering dashboard."""
    
    __tablename__ = "test_conversations"
    
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PostgresUUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    variables = Column(JSON, nullable=False)  # Stores test variables like conversation_context, raw_text, etc.
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    
    def __repr__(self) -> str:
        return f"<TestConversation(id={self.id}, name='{self.name}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary for API responses."""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "description": self.description,
            "variables": self.variables,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }