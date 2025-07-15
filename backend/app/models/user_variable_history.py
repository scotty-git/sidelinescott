"""
UserVariableHistory model - Stores user's previously used prompt template variable values

This table tracks user-specific variable values for suggestions and auto-completion.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserVariableHistory(Base):
    """
    UserVariableHistory model - stores user's variable value history for suggestions
    
    Schema:
    - id: Unique identifier
    - user_id: Reference to the user who used this variable value
    - variable_name: Name of the variable (call_context, additional_context, etc.)
    - variable_value: The actual value the user provided
    - used_at: When this value was last used
    """
    __tablename__ = "user_variable_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    variable_name = Column(String(100), nullable=False)
    variable_value = Column(Text, nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Ensure unique combinations of user, variable, and value
    __table_args__ = (
        UniqueConstraint('user_id', 'variable_name', 'variable_value', name='uq_user_variable_value'),
    )
    
    # Relationships
    user = relationship("User")  # Assuming you have a User model
    
    def __repr__(self):
        return f"<UserVariableHistory(user_id={self.user_id}, variable={self.variable_name}, value='{self.variable_value[:50]}...')>"