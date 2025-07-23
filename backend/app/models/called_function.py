"""
CalledFunction model - Represents function calls made during evaluation

Each called function belongs to a specific evaluation and references a turn.
Multiple functions can be called for the same turn, enabling batch operations
and complex user intent handling.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class CalledFunction(Base):
    """
    CalledFunction model - stores function calls made during evaluation
    
    Schema:
    - id: Unique function call identifier
    - evaluation_id: Reference to the evaluation this function call belongs to
    - turn_id: Reference to the turn that triggered this function call
    - function_name: Name of the function called (e.g., 'update_user_profile')
    - parameters: JSON parameters passed to the function
    - result: JSON result returned by the function
    - executed: Whether the function was technically executed (not correctness)
    - confidence_score: AI confidence in the function call decision (nullable)
    - decision_reasoning: AI reasoning for calling this function (nullable)
    - processing_time_ms: Total time taken to process this function call
    - timing_breakdown: Detailed timing breakdown (JSON)
    - function_template_id: Reference to the function template used
    - gemini_prompt: The exact prompt sent to Gemini
    - gemini_response: The raw response from Gemini
    - template_variables: Variables used in the prompt template
    - mock_data_before: Mock data state before function execution
    - mock_data_after: Mock data state after function execution
    - created_at: When this function call was made
    """
    __tablename__ = "called_functions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    turn_id = Column(UUID(as_uuid=True), ForeignKey("turns.id"), nullable=False)
    
    # Function execution details
    function_name = Column(String(100), nullable=False)
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    executed = Column(Boolean, default=True, nullable=False)
    
    # AI decision metadata (nullable for simple prompts)
    confidence_score = Column(String(10), nullable=True)  # HIGH, MEDIUM, LOW
    decision_reasoning = Column(Text, nullable=True)
    
    # Timing information (detailed breakdown like cleaned_turns)
    processing_time_ms = Column(Float, nullable=False)
    timing_breakdown = Column(JSON, nullable=True)
    
    # Template and prompt tracking
    function_template_id = Column(UUID(as_uuid=True), ForeignKey("function_prompt_templates.id"), nullable=True)
    gemini_prompt = Column(Text, nullable=True)
    gemini_response = Column(Text, nullable=True)
    gemini_http_request = Column(JSON, nullable=True)  # Captured HTTP request to Google for function decision
    template_variables = Column(JSON, nullable=True)
    
    # Mock data state tracking
    mock_data_before = Column(JSON, nullable=True)
    mock_data_after = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="called_functions")
    turn = relationship("Turn")
    function_template = relationship("FunctionPromptTemplate")
    
    def __repr__(self):
        return f"<CalledFunction(id={self.id}, evaluation_id={self.evaluation_id}, function_name='{self.function_name}')>"