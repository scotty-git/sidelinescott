"""
Mock Customer API endpoints
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.mock_customer import MockCustomer, MirroredMockCustomer
from app.schemas.customers import (
    MockCustomerCreate,
    MockCustomerUpdate,
    MockCustomerResponse,
    MirroredMockCustomerResponse,
    BusinessInsightUpdate,
    CustomerListResponse
)

router = APIRouter(tags=["customers"])


@router.get("/", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None, description="Search by name, company, or job title"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List all mock customers with optional search"""
    query = db.query(MockCustomer)
    
    if search:
        search_filter = f"%{search.lower()}%"
        query = query.filter(
            MockCustomer.user_name.ilike(search_filter) |
            MockCustomer.company_name.ilike(search_filter) |
            MockCustomer.job_title.ilike(search_filter)
        )
    
    # Get total count
    total = query.count()
    
    # Get customers with pagination
    customers = query.order_by(desc(MockCustomer.updated_at)).offset(offset).limit(limit).all()
    
    # Get default customer
    default_customer = db.query(MockCustomer).filter(MockCustomer.is_default == True).first()
    
    return CustomerListResponse(
        customers=customers,
        total=total,
        default_customer=default_customer
    )


@router.post("/", response_model=MockCustomerResponse)
async def create_customer(
    customer_data: MockCustomerCreate,
    db: Session = Depends(get_db)
):
    """Create a new mock customer"""
    # If setting as default, unset any existing default
    if customer_data.is_default:
        db.query(MockCustomer).filter(MockCustomer.is_default == True).update({"is_default": False})
    
    customer = MockCustomer(**customer_data.dict())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    
    return customer


@router.get("/default", response_model=Optional[MockCustomerResponse])
async def get_default_customer(db: Session = Depends(get_db)):
    """Get the default customer"""
    default_customer = db.query(MockCustomer).filter(MockCustomer.is_default == True).first()
    return default_customer


@router.get("/{customer_id}", response_model=MockCustomerResponse)
async def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific mock customer"""
    customer = db.query(MockCustomer).filter(MockCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer


@router.put("/{customer_id}", response_model=MockCustomerResponse)
async def update_customer(
    customer_id: UUID,
    customer_data: MockCustomerUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing mock customer"""
    customer = db.query(MockCustomer).filter(MockCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # If setting as default, unset any existing default
    if customer_data.is_default:
        db.query(MockCustomer).filter(MockCustomer.is_default == True).update({"is_default": False})
    
    # Update customer fields
    update_data = customer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)
    
    db.commit()
    db.refresh(customer)
    
    return customer


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a mock customer"""
    customer = db.query(MockCustomer).filter(MockCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if customer is being used in any evaluations
    mirrored_count = db.query(MirroredMockCustomer).filter(
        MirroredMockCustomer.original_customer_id == customer_id
    ).count()
    
    if mirrored_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete customer: currently used in {mirrored_count} evaluations"
        )
    
    db.delete(customer)
    db.commit()
    
    return {"message": "Customer deleted successfully"}


@router.post("/{customer_id}/set-default", response_model=MockCustomerResponse)
async def set_default_customer(
    customer_id: UUID,
    db: Session = Depends(get_db)
):
    """Set a customer as the default"""
    customer = db.query(MockCustomer).filter(MockCustomer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Unset any existing default
    db.query(MockCustomer).filter(MockCustomer.is_default == True).update({"is_default": False})
    
    # Set this customer as default
    customer.is_default = True
    db.commit()
    db.refresh(customer)
    
    return customer


@router.get("/mirrored/{evaluation_id}", response_model=Optional[MirroredMockCustomerResponse])
async def get_mirrored_customer(
    evaluation_id: UUID,
    db: Session = Depends(get_db)
):
    """Get mirrored customer for an evaluation"""
    mirrored_customer = db.query(MirroredMockCustomer).filter(
        MirroredMockCustomer.evaluation_id == evaluation_id
    ).first()
    
    return mirrored_customer


@router.post("/mirrored/{evaluation_id}/insights", response_model=MirroredMockCustomerResponse)
async def update_business_insights(
    evaluation_id: UUID,
    insight_data: BusinessInsightUpdate,
    db: Session = Depends(get_db)
):
    """Update business insights for a mirrored customer"""
    mirrored_customer = db.query(MirroredMockCustomer).filter(
        MirroredMockCustomer.evaluation_id == evaluation_id
    ).first()
    
    if not mirrored_customer:
        raise HTTPException(status_code=404, detail="Mirrored customer not found for this evaluation")
    
    # Update business insights
    if insight_data.append_mode and mirrored_customer.business_insights:
        # Merge with existing insights
        existing_insights = mirrored_customer.business_insights.copy()
        existing_insights.update(insight_data.insights)
        mirrored_customer.business_insights = existing_insights
    else:
        # Replace existing insights
        mirrored_customer.business_insights = insight_data.insights
    
    db.commit()
    db.refresh(mirrored_customer)
    
    return mirrored_customer