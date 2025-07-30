"""
Cost model - Tracks API costs for each turn within an evaluation

Each cost record represents the total API costs (cleaning + function decision)
for a specific turn within a specific evaluation. This provides complete
cost visibility regardless of whether functions were actually called.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Cost(Base):
    """
    Cost model - stores API costs for turn processing
    
    Schema:
    - id: Unique cost record identifier
    - evaluation_id: Reference to the evaluation
    - turn_id: Reference to the turn that was processed
    - cleaning_input_tokens: Input tokens used for cleaning API call
    - cleaning_output_tokens: Output tokens used for cleaning API call
    - cleaning_cost_usd: Cost of cleaning API call in USD
    - function_input_tokens: Input tokens used for function decision API call
    - function_output_tokens: Output tokens used for function decision API call
    - function_cost_usd: Cost of function decision API call in USD
    - total_tokens: Sum of all tokens used
    - total_cost_usd: Total cost in USD for this turn
    - model_used: AI model used (e.g., "gemini-2.5-flash-lite-preview-06-17")
    - created_at: When this cost record was created
    """
    __tablename__ = "costs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    turn_id = Column(UUID(as_uuid=True), ForeignKey("turns.id"), nullable=False)
    
    # Cleaning API costs (always present)
    cleaning_input_tokens = Column(Integer, default=0, nullable=False)
    cleaning_output_tokens = Column(Integer, default=0, nullable=False)
    cleaning_cost_usd = Column(Numeric(10, 6), default=0.0, nullable=False)
    
    # Function decision API costs (present for user turns, 0 for Lumen turns)
    function_input_tokens = Column(Integer, default=0, nullable=False)
    function_output_tokens = Column(Integer, default=0, nullable=False)
    function_cost_usd = Column(Numeric(10, 6), default=0.0, nullable=False)
    
    # Totals
    total_tokens = Column(Integer, default=0, nullable=False)
    total_cost_usd = Column(Numeric(10, 6), default=0.0, nullable=False)
    
    # Metadata
    model_used = Column(String(100), nullable=True)  # Track which model was used
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Unique constraint: one cost record per turn per evaluation
    __table_args__ = (
        UniqueConstraint('turn_id', 'evaluation_id', name='unique_turn_evaluation_cost'),
    )
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="costs")
    turn = relationship("Turn")
    
    def __repr__(self):
        return f"<Cost(id={self.id}, evaluation_id={self.evaluation_id}, turn_id={self.turn_id}, total_cost=${self.total_cost_usd})>"
    
    def calculate_totals(self):
        """Calculate and update total fields"""
        self.total_tokens = (
            self.cleaning_input_tokens + 
            self.cleaning_output_tokens + 
            self.function_input_tokens + 
            self.function_output_tokens
        )
        self.total_cost_usd = self.cleaning_cost_usd + self.function_cost_usd