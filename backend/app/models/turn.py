from sqlalchemy import Column, String, DateTime, Text, JSON, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Turn(Base):
    __tablename__ = "turns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    speaker = Column(String, nullable=False)  # 'User' or 'Lumen'
    raw_text = Column(Text, nullable=False)
    cleaned_text = Column(Text, nullable=False)
    
    # CleanerContext metadata
    confidence_score = Column(String)  # HIGH, MEDIUM, LOW
    cleaning_applied = Column(String)  # true/false as string for JSON compatibility
    cleaning_level = Column(String)    # none, light, full
    processing_time_ms = Column(Float)
    corrections = Column(JSON, default=list)
    context_detected = Column(String)
    ai_model_used = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="turns")