"""
CleanedTurn model - Represents a cleaned version of a raw turn within an evaluation

Each cleaned turn belongs to a specific evaluation and references the original
raw turn from the conversation. This allows multiple evaluations to have
different cleaned versions of the same raw turn.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class CleanedTurn(Base):
    """
    CleanedTurn model - stores the cleaned result of a raw turn for a specific evaluation
    
    Schema:
    - id: Unique cleaned turn identifier
    - evaluation_id: Reference to the evaluation this cleaned turn belongs to
    - turn_id: Reference to the original raw turn from the conversation
    - cleaned_text: The AI-cleaned version of the raw text
    - confidence_score: AI confidence in the cleaning (HIGH, MEDIUM, LOW)
    - cleaning_applied: Whether any cleaning was actually applied
    - cleaning_level: The cleaning level used (none, light, full)
    - processing_time_ms: Time taken to process this turn
    - corrections: JSON array of corrections made
    - context_detected: Business context detected by AI
    - ai_model_used: Which AI model was used for cleaning
    - timing_breakdown: JSON with detailed timing information
    - gemini_prompt: The exact prompt sent to Gemini
    - gemini_response: The raw response from Gemini
    - created_at: When this cleaned turn was created
    """
    __tablename__ = "cleaned_turns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    turn_id = Column(UUID(as_uuid=True), ForeignKey("turns.id"), nullable=False)
    
    # Cleaned content
    cleaned_text = Column(Text, nullable=False)
    
    # AI processing metadata
    confidence_score = Column(String(10), nullable=False)  # HIGH, MEDIUM, LOW
    cleaning_applied = Column(String(10), nullable=False)  # true, false (stored as string for compatibility)
    cleaning_level = Column(String(20), nullable=False)    # none, light, full
    processing_time_ms = Column(Float, nullable=False)
    corrections = Column(JSON, nullable=True)             # Array of correction objects
    context_detected = Column(String(100), nullable=True) # business_conversation, etc.
    ai_model_used = Column(String(100), nullable=True)    # gemini-2.5-flash-lite, etc.
    
    # Detailed processing information
    timing_breakdown = Column(JSON, nullable=True)        # Detailed timing by operation
    gemini_prompt = Column(Text, nullable=True)           # Full prompt sent to AI
    gemini_response = Column(Text, nullable=True)         # Raw AI response
    gemini_http_request = Column(JSON, nullable=True)     # Captured HTTP request to Google
    gemini_http_response = Column(JSON, nullable=True)    # Captured HTTP response from Google
    template_variables = Column(JSON, nullable=True)      # Variables used for template rendering
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="cleaned_turns")
    turn = relationship("Turn")  # Reference to the original raw turn
    
    def __repr__(self):
        return f"<CleanedTurn(id={self.id}, evaluation_id={self.evaluation_id}, turn_id={self.turn_id})>"