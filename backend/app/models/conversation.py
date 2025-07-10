from sqlalchemy import Column, String, DateTime, Integer, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Supabase Auth user ID (no FK constraint)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="active")  # active, paused, completed
    turns_count = Column(Integer, default=0)
    conversation_metadata = Column(JSON, default=dict)
    
    # Context fields for 5-variable system
    call_context = Column(Text, nullable=True)
    additional_context = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships (removed User relationship since we use Supabase Auth)
    turns = relationship("Turn", back_populates="conversation", cascade="all, delete-orphan")
    evaluations = relationship("Evaluation", back_populates="conversation", cascade="all, delete-orphan")