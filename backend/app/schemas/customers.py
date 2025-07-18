"""
Customer schemas for API request/response serialization
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class MockCustomerCreate(BaseModel):
    """Schema for creating a new mock customer"""
    user_name: str
    job_title: str
    company_name: str
    company_description: str
    company_size: str
    company_sector: str
    is_default: bool = False


class MockCustomerUpdate(BaseModel):
    """Schema for updating an existing mock customer"""
    user_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_size: Optional[str] = None
    company_sector: Optional[str] = None
    is_default: Optional[bool] = None


class MockCustomerResponse(BaseModel):
    """Schema for mock customer response"""
    id: UUID
    user_name: str
    job_title: str
    company_name: str
    company_description: str
    company_size: str
    company_sector: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MirroredMockCustomerResponse(BaseModel):
    """Schema for mirrored mock customer response"""
    id: UUID
    evaluation_id: UUID
    original_customer_id: UUID
    user_name: str
    job_title: str
    company_name: str
    company_description: str
    company_size: str
    company_sector: str
    business_insights: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessInsightUpdate(BaseModel):
    """Schema for updating business insights on mirrored customer"""
    insights: Dict[str, Any]
    append_mode: bool = True  # If True, merge with existing; if False, replace


class CustomerListResponse(BaseModel):
    """Schema for customer list response"""
    customers: list[MockCustomerResponse]
    total: int
    default_customer: Optional[MockCustomerResponse] = None