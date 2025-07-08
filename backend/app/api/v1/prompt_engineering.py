"""
Prompt Engineering API - RESTful endpoints for prompt management
"""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.prompt_engineering_service import PromptEngineeringService
from app.schemas.prompt import (
    PromptTemplate,
    CreatePromptTemplateRequest,
    UpdatePromptTemplateRequest,
    RenderPromptRequest,
    RenderedPrompt,
    PromptPerformanceMetrics,
    TurnPromptAnalysis,
    PromptInsights,
    CreateABTestRequest,
    PromptSimulationRequest
)

logger = logging.getLogger(__name__)

router = APIRouter()
prompt_service = PromptEngineeringService()


@router.get("/templates", response_model=List[PromptTemplate])
async def get_prompt_templates(
    include_inactive: bool = Query(False, description="Include inactive templates"),
    db: Session = Depends(get_db)
):
    """Get all prompt templates"""
    templates = await prompt_service.get_templates(db, include_inactive=include_inactive)
    
    # If no templates found (DB unavailable or empty), return default template
    if not templates:
        from datetime import datetime
        logger.info("No templates found, returning default template")
        return [
            PromptTemplate(
                id="00000000-0000-0000-0000-000000000001",
                name="CleanerContext Default",
                template=prompt_service.default_template,
                description="Default prompt template for CleanerContext cleaning",
                variables=["conversation_context", "raw_text", "cleaning_level"],
                version="1.0.0",
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
        ]
    
    return [
        PromptTemplate(
            id=str(t.id),
            name=t.name,
            template=t.template,
            description=t.description,
            variables=t.variables,
            version=t.version,
            is_active=t.is_active,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in templates
    ]


@router.get("/templates/{template_id}", response_model=PromptTemplate)
async def get_prompt_template(
    template_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific prompt template"""
    # Handle default template
    if template_id == "00000000-0000-0000-0000-000000000001":
        from datetime import datetime
        return PromptTemplate(
            id="00000000-0000-0000-0000-000000000001",
            name="CleanerContext Default",
            template=prompt_service.default_template,
            description="Default prompt template for CleanerContext cleaning",
            variables=["conversation_context", "raw_text", "cleaning_level"],
            version="1.0.0",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    template = await prompt_service.get_template(db, UUID(template_id))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return PromptTemplate(
        id=str(template.id),
        name=template.name,
        template=template.template,
        description=template.description,
        variables=template.variables,
        version=str(template.version),
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.post("/templates", response_model=PromptTemplate)
async def create_prompt_template(
    request: CreatePromptTemplateRequest,
    db: Session = Depends(get_db)
):
    """Create a new prompt template"""
    try:
        template = await prompt_service.create_template(
            db=db,
            name=request.name,
            template=request.template,
            description=request.description,
            variables=request.variables
        )
        
        return PromptTemplate(
            id=str(template.id),
            name=template.name,
            template=template.template,
            description=template.description,
            variables=template.variables,
            version=template.version,
            is_active=template.is_active,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create template: {str(e)}")


@router.put("/templates/{template_id}", response_model=PromptTemplate)
async def update_prompt_template(
    template_id: UUID,
    request: UpdatePromptTemplateRequest,
    db: Session = Depends(get_db)
):
    """Update an existing prompt template"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    
    template = await prompt_service.update_template(db, template_id, **updates)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return PromptTemplate(
        id=str(template.id),
        name=template.name,
        template=template.template,
        description=template.description,
        variables=template.variables,
        version=template.version,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.post("/templates/{template_id}/activate")
async def activate_template(
    template_id: UUID,
    db: Session = Depends(get_db)
):
    """Set a template as the active one"""
    success = await prompt_service.set_active_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template activated successfully"}


@router.post("/templates/{template_id}/render", response_model=RenderedPrompt)
async def render_prompt(
    template_id: UUID,
    request: RenderPromptRequest,
    db: Session = Depends(get_db)
):
    """Render a prompt with given variables"""
    rendered = await prompt_service.render_prompt(db, template_id, request.variables)
    if not rendered:
        raise HTTPException(status_code=400, detail="Failed to render prompt - check variables")
    
    return rendered


@router.get("/templates/{template_id}/performance", response_model=PromptPerformanceMetrics)
async def get_template_performance(
    template_id: UUID,
    db: Session = Depends(get_db)
):
    """Get performance metrics for a template"""
    metrics = await prompt_service.get_template_performance(db, template_id)
    return metrics


@router.get("/turns/{turn_id}/prompt-analysis", response_model=TurnPromptAnalysis)
async def get_turn_prompt_analysis(
    turn_id: UUID,
    db: Session = Depends(get_db)
):
    """Get detailed prompt analysis for a specific turn"""
    analysis = await prompt_service.get_turn_prompt_analysis(db, turn_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Turn or prompt analysis not found")
    
    return analysis


@router.get("/insights", response_model=PromptInsights)
async def get_prompt_insights(
    db: Session = Depends(get_db)
):
    """Get comprehensive prompt engineering insights"""
    insights = await prompt_service.get_prompt_insights(db)
    return insights


@router.post("/ab-tests")
async def create_ab_test(
    request: CreateABTestRequest,
    db: Session = Depends(get_db)
):
    """Create a new A/B test for prompt comparison"""
    try:
        ab_test = await prompt_service.create_ab_test(
            db=db,
            name=request.name,
            prompt_a_id=UUID(request.prompt_a_id),
            prompt_b_id=UUID(request.prompt_b_id),
            description=request.description,
            traffic_split=request.traffic_split_percent
        )
        
        return {
            "id": str(ab_test.id),
            "name": ab_test.name,
            "description": ab_test.description,
            "prompt_a_id": str(ab_test.prompt_a_id),
            "prompt_b_id": str(ab_test.prompt_b_id),
            "traffic_split_percent": ab_test.traffic_split_percent,
            "is_active": ab_test.is_active,
            "created_at": ab_test.created_at
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create A/B test: {str(e)}")


@router.get("/ab-tests/active")
async def get_active_ab_test(
    db: Session = Depends(get_db)
):
    """Get the currently active A/B test"""
    ab_test = await prompt_service.get_active_ab_test(db)
    if not ab_test:
        return {"message": "No active A/B test"}
    
    return {
        "id": str(ab_test.id),
        "name": ab_test.name,
        "description": ab_test.description,
        "prompt_a_id": str(ab_test.prompt_a_id),
        "prompt_b_id": str(ab_test.prompt_b_id),
        "traffic_split_percent": ab_test.traffic_split_percent,
        "created_at": ab_test.created_at
    }


@router.post("/templates/{template_id}/simulate")
async def simulate_prompt(
    template_id: UUID,
    request: PromptSimulationRequest,
    db: Session = Depends(get_db)
):
    """Test a prompt against sample data without calling Gemini"""
    template = await prompt_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build variables for the prompt
    context_str = ""
    if request.sample_context:
        context_str = "\n".join([
            f"{turn['speaker']}: {turn['cleaned_text']}" 
            for turn in request.sample_context[-5:]  # Last 5 turns
        ])
    
    variables = {
        "conversation_context": context_str,
        "raw_text": request.sample_raw_text,
        "cleaning_level": request.cleaning_level
    }
    
    # Render the prompt
    rendered = await prompt_service.render_prompt(db, template_id, variables)
    if not rendered:
        raise HTTPException(status_code=400, detail="Failed to render prompt")
    
    return {
        "template_used": {
            "id": str(template.id),
            "name": template.name,
            "version": template.version
        },
        "input_variables": variables,
        "rendered_prompt": rendered.rendered_prompt,
        "token_count": rendered.token_count,
        "simulation_note": "This is a simulation - no actual Gemini API call was made"
    }


@router.get("/default-template")
async def get_or_create_default_template(
    db: Session = Depends(get_db)
):
    """Get or create the default CleanerContext template"""
    template = await prompt_service.get_or_create_default_template(db)
    
    return {
        "id": str(template.id),
        "name": template.name,
        "template": template.template,
        "description": template.description,
        "variables": template.variables,
        "version": template.version,
        "is_active": template.is_active,
        "created_at": template.created_at
    }