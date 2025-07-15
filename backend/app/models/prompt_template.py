"""
Prompt Template Model - Database storage for prompt engineering
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class PromptTemplate(Base):
    """Database model for prompt templates"""
    __tablename__ = "prompt_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    template = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    variables = Column(JSON, nullable=False, default=list)  # List of variable names
    version = Column(String(50), nullable=False, default="1.0.0")
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PromptTemplate(name='{self.name}', version='{self.version}')>"


class PromptUsage(Base):
    """Track usage of prompt templates"""
    __tablename__ = "prompt_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), nullable=False)
    turn_id = Column(UUID(as_uuid=True), nullable=True)  # Link to turn if available
    conversation_id = Column(UUID(as_uuid=True), nullable=True)
    rendered_prompt = Column(Text, nullable=False)
    variables_used = Column(JSON, nullable=False, default=dict)
    token_count = Column(Integer, nullable=True)
    processing_time_ms = Column(Float, nullable=True)
    confidence_score = Column(String(10), nullable=True)
    corrections_count = Column(Integer, default=0)
    context_turns_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<PromptUsage(template_id='{self.template_id}')>"


class ABTest(Base):
    """A/B test configuration for prompt comparison"""
    __tablename__ = "ab_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prompt_a_id = Column(UUID(as_uuid=True), nullable=False)
    prompt_b_id = Column(UUID(as_uuid=True), nullable=False)
    traffic_split_percent = Column(Integer, default=50)  # Percentage for prompt A
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<ABTest(name='{self.name}', active={self.is_active})>"


class ABTestResult(Base):
    """Results from A/B tests"""
    __tablename__ = "ab_test_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), nullable=False)
    prompt_variant = Column(String(1), nullable=False)  # "A" or "B"
    turn_id = Column(UUID(as_uuid=True), nullable=True)
    processing_time_ms = Column(Float, nullable=True)
    confidence_score = Column(String(10), nullable=True)
    corrections_count = Column(Integer, default=0)
    success = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ABTestResult(test_id='{self.test_id}', variant='{self.prompt_variant}')>"