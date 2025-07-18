"""
MockCustomer models - Represents mock customer data for function calling tests

Contains two models:
1. MockCustomer - Original customer templates
2. MirroredMockCustomer - Evaluation-specific copies that can be modified by functions
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class MockCustomer(Base):
    """
    MockCustomer model - stores original customer templates for function calling tests
    
    Schema:
    - id: Unique customer identifier
    - user_name: Customer name (e.g., "Scott")
    - job_title: Customer job title (e.g., "Head of Marketing")
    - company_name: Company name (e.g., "Quick Fit Windows")
    - company_description: Company description
    - company_size: Company size (e.g., "20 to 50 people")
    - company_sector: Company sector (e.g., "window repairs")
    - is_default: Whether this is the default customer for new evaluations
    - created_at: When this customer was created
    - updated_at: When this customer was last updated
    """
    __tablename__ = "mock_customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Customer and company information (matching your exact specification)
    user_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    company_description = Column(Text, nullable=False)
    company_size = Column(String(100), nullable=False)
    company_sector = Column(String(255), nullable=False)
    
    # System fields
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    mirrored_customers = relationship("MirroredMockCustomer", back_populates="original_customer")
    
    def __repr__(self):
        return f"<MockCustomer(id={self.id}, user_name='{self.user_name}', company='{self.company_name}')>"
    
    def to_dict(self) -> dict:
        """Convert customer to dictionary for easy copying"""
        return {
            "user_name": self.user_name,
            "job_title": self.job_title,
            "company_name": self.company_name,
            "company_description": self.company_description,
            "company_size": self.company_size,
            "company_sector": self.company_sector
        }


class MirroredMockCustomer(Base):
    """
    MirroredMockCustomer model - evaluation-specific copies that can be modified by functions
    
    Schema:
    - id: Unique mirrored customer identifier
    - evaluation_id: Reference to the evaluation this belongs to
    - original_customer_id: Reference to the original mock customer template
    - user_name: Customer name (modifiable)
    - job_title: Customer job title (modifiable)
    - company_name: Company name (modifiable)
    - company_description: Company description (modifiable)
    - company_size: Company size (modifiable)
    - company_sector: Company sector (modifiable)
    - business_insights: Dynamic JSON field for AI-collected insights
    - created_at: When this mirror was created
    - updated_at: When this mirror was last updated
    """
    __tablename__ = "mirrored_mock_customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    original_customer_id = Column(UUID(as_uuid=True), ForeignKey("mock_customers.id"), nullable=False)
    
    # Customer and company information (modifiable copies)
    user_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    company_description = Column(Text, nullable=False)
    company_size = Column(String(100), nullable=False)
    company_sector = Column(String(255), nullable=False)
    
    # Business insights collected during function calling (dynamic JSON field)
    business_insights = Column(JSON, nullable=True)
    
    # System fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="mirrored_customer")
    original_customer = relationship("MockCustomer", back_populates="mirrored_customers")
    
    def __repr__(self):
        return f"<MirroredMockCustomer(id={self.id}, evaluation_id={self.evaluation_id}, user_name='{self.user_name}')>"
    
    def to_dict(self) -> dict:
        """Convert mirrored customer to dictionary"""
        return {
            "user_name": self.user_name,
            "job_title": self.job_title,
            "company_name": self.company_name,
            "company_description": self.company_description,
            "company_size": self.company_size,
            "company_sector": self.company_sector,
            "business_insights": self.business_insights
        }
    
    @classmethod
    def from_mock_customer(cls, mock_customer: MockCustomer, evaluation_id: str) -> 'MirroredMockCustomer':
        """Create mirrored customer from original mock customer"""
        return cls(
            evaluation_id=evaluation_id,
            original_customer_id=mock_customer.id,
            user_name=mock_customer.user_name,
            job_title=mock_customer.job_title,
            company_name=mock_customer.company_name,
            company_description=mock_customer.company_description,
            company_size=mock_customer.company_size,
            company_sector=mock_customer.company_sector
        )
    
    def compare_with_original(self, original: MockCustomer) -> dict:
        """Compare current state with original mock customer"""
        changes = {}
        
        fields = ['user_name', 'job_title', 'company_name', 'company_description', 'company_size', 'company_sector']
        
        for field in fields:
            original_value = getattr(original, field)
            current_value = getattr(self, field)
            
            if original_value != current_value:
                changes[field] = {
                    'original': original_value,
                    'current': current_value
                }
        
        return changes