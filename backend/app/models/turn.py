from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Turn(Base):
    __tablename__ = "turns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    turn_sequence = Column(Integer, nullable=False)  # Sequential number within conversation (1, 2, 3, ...)
    speaker = Column(String, nullable=False)  # 'User' or 'Lumen'
    raw_text = Column(Text, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="turns")