"""
Evaluation model - Represents a cleaning evaluation of a conversation

An evaluation is a specific instance of cleaning a conversation with particular
settings, prompts, and parameters. Multiple evaluations can exist for the same
conversation to compare different cleaning approaches.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Evaluation(Base):
    """
    Evaluation model - tracks a specific cleaning evaluation of a conversation
    
    Schema:
    - id: Unique evaluation identifier
    - conversation_id: Reference to the conversation being evaluated
    - name: Human-readable name for this evaluation
    - description: Optional description of the evaluation approach
    - prompt_template: The prompt template used for this evaluation
    - settings: JSON object with evaluation settings (cleaning_level, model_params, etc.)
    - user_id: User who created this evaluation
    - status: active, completed, archived
    - created_at: When the evaluation was created
    - updated_at: When the evaluation was last modified
    """
    __tablename__ = "evaluations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prompt_template = Column(Text, nullable=True)  # The actual prompt template used (deprecated - use prompt_template_id)
    prompt_template_id = Column(UUID(as_uuid=True), ForeignKey("prompt_templates.id"), nullable=True)  # Reference to prompt template
    settings = Column(JSON, nullable=True)  # cleaning_level, model_params, sliding_window, etc.
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Supabase Auth user ID (no FK constraint)
    status = Column(String(50), default="active", nullable=False)  # active, completed, archived
    turns_processed = Column(Integer, default=0, nullable=False)  # Number of turns processed
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="evaluations")
    cleaned_turns = relationship("CleanedTurn", back_populates="evaluation", cascade="all, delete-orphan")
    prompt_template_ref = relationship("PromptTemplate", foreign_keys=[prompt_template_id])
    
    def __repr__(self):
        return f"<Evaluation(id={self.id}, name='{self.name}', conversation_id={self.conversation_id})>"