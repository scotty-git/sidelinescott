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
from app.models import Conversation, Turn
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
    PromptSimulationRequest,
    ConversationSimulationRequest,
    CreateTestConversationRequest,
    UpdateTestConversationRequest,
    TestConversationResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()
prompt_service = PromptEngineeringService()


@router.get("/templates", response_model=List[PromptTemplate])
async def get_prompt_templates(
    db: Session = Depends(get_db)
):
    """Get all prompt templates"""
    templates = await prompt_service.get_templates(db)
    
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
            is_default=t.is_default,
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
        is_default=template.is_default,
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
            is_default=template.is_default,
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
    try:
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
            is_default=template.is_default,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a template with constraint enforcement"""
    try:
        success = await prompt_service.delete_template(db, template_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        return {"message": "Template deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete template: {str(e)}")


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
        "is_default": template.is_default,
        "created_at": template.created_at
    }


@router.get("/templates/default/current", response_model=PromptTemplate)
async def get_current_default_template(
    db: Session = Depends(get_db)
):
    """Get the current default template"""
    template = await prompt_service.get_default_template(db)
    if not template:
        raise HTTPException(status_code=404, detail="No default template found")
    
    return PromptTemplate(
        id=str(template.id),
        name=template.name,
        template=template.template,
        description=template.description,
        variables=template.variables,
        version=template.version,
        is_default=template.is_default,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.post("/templates/{template_id}/set-default", response_model=PromptTemplate)
async def set_template_as_default(
    template_id: UUID,
    db: Session = Depends(get_db)
):
    """Set a template as the default (and unset all others)"""
    try:
        template = await prompt_service.set_default_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return PromptTemplate(
            id=str(template.id),
            name=template.name,
            template=template.template,
            description=template.description,
            variables=template.variables,
            version=template.version,
            is_default=template.is_default,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set default template: {str(e)}")


# Test Conversation Management Endpoints

@router.post("/test-conversations", response_model=TestConversationResponse)
async def create_test_conversation(
    request: CreateTestConversationRequest,
    db: Session = Depends(get_db)
):
    """Create a new test conversation"""
    try:
        test_conversation = await prompt_service.create_test_conversation(
            db=db,
            user_id=request.user_id,
            name=request.name,
            description=request.description,
            variables=request.variables
        )
        return TestConversationResponse(**test_conversation.to_dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create test conversation: {str(e)}")


@router.get("/test-conversations", response_model=List[TestConversationResponse])
async def get_test_conversations(
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    db: Session = Depends(get_db)
):
    """Get all test conversations, optionally filtered by user"""
    test_conversations = await prompt_service.get_test_conversations(db, user_id=user_id)
    return [TestConversationResponse(**tc.to_dict()) for tc in test_conversations]


@router.get("/test-conversations/{test_conversation_id}", response_model=TestConversationResponse)
async def get_test_conversation(
    test_conversation_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific test conversation"""
    test_conversation = await prompt_service.get_test_conversation(db, test_conversation_id)
    if not test_conversation:
        raise HTTPException(status_code=404, detail="Test conversation not found")
    return TestConversationResponse(**test_conversation.to_dict())


@router.put("/test-conversations/{test_conversation_id}", response_model=TestConversationResponse)
async def update_test_conversation(
    test_conversation_id: UUID,
    request: UpdateTestConversationRequest,
    db: Session = Depends(get_db)
):
    """Update an existing test conversation"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    test_conversation = await prompt_service.update_test_conversation(db, test_conversation_id, **updates)
    if not test_conversation:
        raise HTTPException(status_code=404, detail="Test conversation not found")
    return TestConversationResponse(**test_conversation.to_dict())


@router.delete("/test-conversations/{test_conversation_id}")
async def delete_test_conversation(
    test_conversation_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a test conversation"""
    success = await prompt_service.delete_test_conversation(db, test_conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test conversation not found")
    return {"message": "Test conversation deleted successfully"}


@router.post("/templates/{template_id}/simulate/conversation")
async def simulate_prompt_with_conversation(
    template_id: UUID,
    request: ConversationSimulationRequest,
    db: Session = Depends(get_db)
):
    """Test a prompt against real conversation data"""
    # Get the template
    template = await prompt_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get the conversation
    conversation = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get all turns for the conversation
    turns = db.query(Turn).filter(Turn.conversation_id == request.conversation_id).order_by(Turn.created_at).all()
    if not turns:
        raise HTTPException(status_code=404, detail="No turns found for this conversation")
    
    if request.testing_mode == "single_turn":
        # Single turn testing
        if request.turn_index is None:
            raise HTTPException(status_code=400, detail="turn_index is required for single_turn mode")
        
        if request.turn_index >= len(turns):
            raise HTTPException(status_code=400, detail="turn_index out of range")
        
        selected_turn = turns[request.turn_index]
        
        # Build context from previous turns
        context_turns = turns[max(0, request.turn_index - 5):request.turn_index]
        context_str = "\n".join([
            f"{turn.speaker}: {turn.cleaned_text or turn.raw_text}" 
            for turn in context_turns
        ])
        
        # Build variables
        variables = {
            "conversation_context": context_str,
            "raw_text": selected_turn.raw_text,
            "cleaning_level": "full",
            "call_context": getattr(conversation, 'call_context', ''),
            "additional_context": getattr(conversation, 'additional_context', ''),
            "custom_variable": request.custom_variable or ""
        }
        
        # Render the prompt
        rendered = await prompt_service.render_prompt(db, template_id, variables)
        if not rendered:
            raise HTTPException(status_code=400, detail="Failed to render prompt")
        
        return {
            "mode": "single_turn",
            "template_used": {
                "id": str(template.id),
                "name": template.name,
                "version": template.version
            },
            "conversation": {
                "id": str(conversation.id),
                "name": conversation.name
            },
            "turn_tested": {
                "index": request.turn_index,
                "speaker": selected_turn.speaker,
                "raw_text": selected_turn.raw_text,
                "cleaned_text": selected_turn.cleaned_text
            },
            "context_turns_used": len(context_turns),
            "input_variables": variables,
            "rendered_prompt": rendered.rendered_prompt,
            "token_count": rendered.token_count,
            "simulation_note": "This is a simulation - no actual Gemini API call was made"
        }
    
    elif request.testing_mode == "full_conversation":
        # Full conversation testing
        results = []
        
        # Test each user turn (skip Lumen turns)
        for i, turn in enumerate(turns):
            if turn.speaker == "Lumen":
                continue
            
            # Build context from previous turns
            context_turns = turns[max(0, i - 5):i]
            context_str = "\n".join([
                f"{turn.speaker}: {turn.cleaned_text or turn.raw_text}" 
                for turn in context_turns
            ])
            
            # Build variables
            variables = {
                "conversation_context": context_str,
                "raw_text": turn.raw_text,
                "cleaning_level": "full",
                "call_context": getattr(conversation, 'call_context', ''),
                "additional_context": getattr(conversation, 'additional_context', ''),
                "custom_variable": request.custom_variable or ""
            }
            
            # Render the prompt
            rendered = await prompt_service.render_prompt(db, template_id, variables)
            if rendered:
                results.append({
                    "turn_index": i,
                    "speaker": turn.speaker,
                    "raw_text": turn.raw_text,
                    "cleaned_text": turn.cleaned_text,
                    "context_turns_used": len(context_turns),
                    "rendered_prompt": rendered.rendered_prompt,
                    "token_count": rendered.token_count,
                    "success": True
                })
            else:
                results.append({
                    "turn_index": i,
                    "speaker": turn.speaker,
                    "raw_text": turn.raw_text,
                    "error": "Failed to render prompt",
                    "success": False
                })
        
        return {
            "mode": "full_conversation",
            "template_used": {
                "id": str(template.id),
                "name": template.name,
                "version": template.version
            },
            "conversation": {
                "id": str(conversation.id),
                "name": conversation.name,
                "total_turns": len(turns),
                "user_turns_processed": len(results)
            },
            "results": results,
            "summary": {
                "total_turns_tested": len(results),
                "successful_renders": sum(1 for r in results if r["success"]),
                "failed_renders": sum(1 for r in results if not r["success"]),
                "avg_token_count": sum(r.get("token_count", 0) for r in results) / len(results) if results else 0
            },
            "simulation_note": "This is a simulation - no actual Gemini API calls were made"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid testing_mode. Must be 'single_turn' or 'full_conversation'")