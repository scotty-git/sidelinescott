"""
Evaluation API endpoints - Evaluation-based conversation processing

Handles the evaluation system where multiple evaluations can be run
on the same conversation with different prompts and settings.
"""

import logging
import time
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.evaluation import Evaluation
from app.models.cleaned_turn import CleanedTurn
from app.models.conversation import Conversation
from app.models.turn import Turn
from app.schemas.evaluations import (
    CreateEvaluationRequest,
    EvaluationResponse,
    ProcessTurnRequest,
    CleanedTurnResponse,
    EvaluationDetailsResponse,
    ListEvaluationsResponse
)
from app.services.evaluation_manager import EvaluationManager

router = APIRouter()
logger = logging.getLogger(__name__)

# Global evaluation manager instance
evaluation_manager = EvaluationManager()

@router.post("/conversations/{conversation_id}/evaluations", response_model=EvaluationResponse)
async def create_evaluation(
    conversation_id: str,
    evaluation_data: CreateEvaluationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new evaluation for a conversation"""
    print(f"[EvaluationsAPI] Creating evaluation '{evaluation_data.name}' for conversation {conversation_id}")
    
    try:
        conversation_uuid = UUID(conversation_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify conversation exists and user has access
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_uuid,
        Conversation.user_id == user_uuid
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied"
        )
    
    try:
        # Convert prompt_template_id to UUID if provided
        prompt_template_id = None
        if evaluation_data.prompt_template_id:
            try:
                prompt_template_id = UUID(evaluation_data.prompt_template_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid prompt_template_id format"
                )
        
        evaluation = await evaluation_manager.create_evaluation(
            conversation_id=conversation_uuid,
            name=evaluation_data.name,
            user_id=user_uuid,
            description=evaluation_data.description,
            prompt_template=evaluation_data.prompt_template,
            prompt_template_id=prompt_template_id,
            settings=evaluation_data.settings,
            db=db
        )
        
        print(f"[EvaluationsAPI] ✅ Created evaluation {evaluation.id}")
        
        return EvaluationResponse(
            id=str(evaluation.id),
            conversation_id=str(evaluation.conversation_id),
            name=evaluation.name,
            description=evaluation.description,
            prompt_template=evaluation.prompt_template,
            settings=evaluation.settings or {},
            user_id=str(evaluation.user_id),
            status=evaluation.status,
            turns_processed=evaluation.turns_processed,
            created_at=evaluation.created_at.isoformat(),
            updated_at=evaluation.updated_at.isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to create evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create evaluation: {str(e)}"
        )

@router.get("/conversations/{conversation_id}/evaluations", response_model=ListEvaluationsResponse)
async def list_evaluations(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all evaluations for a conversation"""
    try:
        conversation_uuid = UUID(conversation_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify conversation access
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_uuid,
        Conversation.user_id == user_uuid
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied"
        )
    
    # Get evaluations
    evaluations = db.query(Evaluation).filter(
        Evaluation.conversation_id == conversation_uuid
    ).order_by(Evaluation.created_at.desc()).all()
    
    evaluation_responses = [
        EvaluationResponse(
            id=str(eval.id),
            conversation_id=str(eval.conversation_id),
            name=eval.name,
            description=eval.description,
            prompt_template=eval.prompt_template,
            settings=eval.settings or {},
            user_id=str(eval.user_id),
            status=eval.status,
            turns_processed=eval.turns_processed,
            created_at=eval.created_at.isoformat(),
            updated_at=eval.updated_at.isoformat()
        )
        for eval in evaluations
    ]
    
    return ListEvaluationsResponse(
        evaluations=evaluation_responses,
        total=len(evaluation_responses),
        page=1,
        per_page=20
    )

@router.get("/{evaluation_id}", response_model=EvaluationDetailsResponse)
async def get_evaluation_details(
    evaluation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed evaluation information with cleaned turns"""
    print(f"[DEBUG] get_evaluation_details called with evaluation_id: {evaluation_id}")
    print(f"[DEBUG] current_user: {current_user}")
    
    try:
        evaluation_uuid = UUID(evaluation_id)
        user_uuid = UUID(current_user["id"])
        print(f"[DEBUG] Parsed UUIDs - evaluation_uuid: {evaluation_uuid}, user_uuid: {user_uuid}")
    except ValueError as e:
        print(f"[DEBUG] UUID parsing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Get evaluation and verify access
    print(f"[DEBUG] Querying database for evaluation...")
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == user_uuid
    ).first()
    
    print(f"[DEBUG] Database query result: {evaluation}")
    
    if not evaluation:
        print(f"[DEBUG] Evaluation not found - returning 404")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied"
        )
    
    print(f"[DEBUG] Evaluation found: {evaluation.id}, proceeding with cleaned turns...")
    
    # Get cleaned turns with raw turn data ordered by original turn sequence
    cleaned_turns = db.query(CleanedTurn).join(Turn).filter(
        CleanedTurn.evaluation_id == evaluation_uuid
    ).order_by(Turn.turn_sequence.asc()).all()
    
    # Get conversation info
    conversation = db.query(Conversation).filter(
        Conversation.id == evaluation.conversation_id
    ).first()
    
    # Get total raw turns count
    total_raw_turns = db.query(Turn).filter(
        Turn.conversation_id == evaluation.conversation_id
    ).count()
    
    cleaned_turn_responses = [
        CleanedTurnResponse(
            id=str(ct.id),
            evaluation_id=str(ct.evaluation_id),
            turn_id=str(ct.turn_id),
            cleaned_text=ct.cleaned_text,
            confidence_score=ct.confidence_score,
            cleaning_applied=ct.cleaning_applied == "true",
            cleaning_level=ct.cleaning_level,
            processing_time_ms=ct.processing_time_ms,
            corrections=ct.corrections or [],
            context_detected=ct.context_detected,
            ai_model_used=ct.ai_model_used,
            created_at=ct.created_at.isoformat(),
            raw_speaker=ct.turn.speaker,
            raw_text=ct.turn.raw_text,
            turn_sequence=ct.turn.turn_sequence,
            gemini_prompt=ct.gemini_prompt,
            gemini_response=ct.gemini_response,
            template_variables=ct.template_variables,
            timing_breakdown=ct.timing_breakdown
        )
        for ct in cleaned_turns
    ]
    
    evaluation_response = EvaluationResponse(
        id=str(evaluation.id),
        conversation_id=str(evaluation.conversation_id),
        name=evaluation.name,
        description=evaluation.description,
        prompt_template=evaluation.prompt_template,
        settings=evaluation.settings or {},
        user_id=str(evaluation.user_id),
        status=evaluation.status,
        turns_processed=evaluation.turns_processed,
        created_at=evaluation.created_at.isoformat(),
        updated_at=evaluation.updated_at.isoformat()
    )
    
    return EvaluationDetailsResponse(
        evaluation=evaluation_response,
        cleaned_turns=cleaned_turn_responses,
        conversation_name=conversation.name if conversation else "Unknown",
        total_raw_turns=total_raw_turns
    )

@router.post("/{evaluation_id}/process-turn", response_model=CleanedTurnResponse)
async def process_turn(
    evaluation_id: str,
    turn_data: ProcessTurnRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process a single turn through this evaluation"""
    print(f"[EvaluationsAPI] Processing turn {turn_data.turn_id} in evaluation {evaluation_id}")
    
    try:
        evaluation_uuid = UUID(evaluation_id)
        turn_uuid = UUID(turn_data.turn_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify evaluation access
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == user_uuid
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied"
        )
    
    # Verify turn belongs to evaluation's conversation
    turn = db.query(Turn).filter(
        Turn.id == turn_uuid,
        Turn.conversation_id == evaluation.conversation_id
    ).first()
    
    if not turn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turn not found or doesn't belong to this conversation"
        )
    
    try:
        result = await evaluation_manager.process_turn(
            evaluation_id=evaluation_uuid,
            turn_id=turn_uuid,
            db=db,
            override_settings=turn_data.settings
        )
        
        print(f"[EvaluationsAPI] ✅ Turn processed successfully")
        
        return CleanedTurnResponse(
            id=result['cleaned_turn_id'],
            evaluation_id=result['evaluation_id'],
            turn_id=result['turn_id'],
            cleaned_text=result['cleaned_text'],
            confidence_score=result['metadata']['confidence_score'],
            cleaning_applied=result['metadata']['cleaning_applied'],
            cleaning_level=result['metadata']['cleaning_level'],
            processing_time_ms=result['metadata']['processing_time_ms'],
            corrections=result['metadata']['corrections'],
            context_detected=result['metadata']['context_detected'],
            ai_model_used=result['metadata']['ai_model_used'],
            created_at=result['created_at'],
            raw_speaker=result['speaker'],
            raw_text=result['raw_text'],
            turn_sequence=result['turn_sequence'],
            gemini_prompt=result.get('gemini_prompt'),
            gemini_response=result.get('gemini_response'),
            gemini_function_call=result.get('gemini_function_call'),
            template_variables=result.get('template_variables'),
            timing_breakdown=result.get('timing_breakdown')
        )
        
    except Exception as e:
        logger.error(f"Failed to process turn: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process turn: {str(e)}"
        )

@router.get("/performance")
async def get_evaluation_performance_metrics():
    """
    Get performance metrics for the evaluation system.
    
    Returns timing statistics, processing counts, and performance targets.
    """
    print(f"[EvaluationsAPI] Getting evaluation performance metrics")
    
    try:
        metrics = evaluation_manager.get_performance_metrics()
        
        print(f"[EvaluationsAPI] Performance metrics retrieved")
        print(f"[EvaluationsAPI] Total turns processed: {metrics['summary']['total_turns_processed']}")
        print(f"[EvaluationsAPI] Lumen turns: {metrics['summary']['total_lumen_turns']}")
        print(f"[EvaluationsAPI] User turns: {metrics['summary']['total_user_turns']}")
        
        return {
            'success': True,
            'performance_metrics': metrics,
            'timestamp': time.time()
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance metrics: {str(e)}"
        )

@router.post("/{evaluation_id}/process-all")
async def process_all_turns(
    evaluation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process all turns in the conversation through this evaluation"""
    print(f"[EvaluationsAPI] Processing all turns for evaluation {evaluation_id}")
    
    try:
        evaluation_uuid = UUID(evaluation_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify evaluation access
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == user_uuid
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied"
        )
    
    # Get all raw turns for this conversation ordered by sequence
    raw_turns = db.query(Turn).filter(
        Turn.conversation_id == evaluation.conversation_id
    ).order_by(Turn.turn_sequence.asc()).all()
    
    if not raw_turns:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No turns found in conversation"
        )
    
    print(f"[EvaluationsAPI] Found {len(raw_turns)} raw turns to process")
    
    processed_results = []
    failed_turns = []
    
    try:
        for i, raw_turn in enumerate(raw_turns):
            # Check if evaluation has been stopped before processing each turn
            if evaluation_manager.is_evaluation_stopped(evaluation_uuid):
                print(f"[EvaluationsAPI] ⏹️ Evaluation {evaluation_uuid} stopped at turn {i+1}/{len(raw_turns)}")
                break
            
            print(f"[EvaluationsAPI] Processing turn {i+1}/{len(raw_turns)}: {raw_turn.speaker}")
            
            try:
                result = await evaluation_manager.process_turn(
                    evaluation_id=evaluation_uuid,
                    turn_id=raw_turn.id,
                    db=db
                )
                processed_results.append(result)
                print(f"[EvaluationsAPI] ✅ Turn {i+1} processed successfully")
                
            except Exception as turn_error:
                # Check if the error is due to stopped evaluation
                if "has been stopped" in str(turn_error):
                    print(f"[EvaluationsAPI] ⏹️ Evaluation stopped during turn {i+1} processing")
                    break
                
                error_info = {
                    'turn_id': str(raw_turn.id),
                    'speaker': raw_turn.speaker,
                    'error': str(turn_error)
                }
                failed_turns.append(error_info)
                print(f"[EvaluationsAPI] ❌ Turn {i+1} failed: {turn_error}")
        
        # Check if evaluation was stopped
        was_stopped = evaluation_manager.is_evaluation_stopped(evaluation_uuid)
        
        print(f"[EvaluationsAPI] ✅ Batch processing complete")
        print(f"[EvaluationsAPI] Successful: {len(processed_results)}, Failed: {len(failed_turns)}")
        if was_stopped:
            print(f"[EvaluationsAPI] ⏹️ Processing was stopped by user")
        
        return {
            'success': True,
            'evaluation_id': str(evaluation_uuid),
            'total_turns': len(raw_turns),
            'processed_successfully': len(processed_results),
            'failed_turns': len(failed_turns),
            'failed_details': failed_turns,
            'was_stopped': was_stopped,
            'message': f"Processed {len(processed_results)}/{len(raw_turns)} turns successfully" + (" (stopped by user)" if was_stopped else "")
        }
        
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing failed: {str(e)}"
        )

@router.post("/{evaluation_id}/stop")
async def stop_evaluation(
    evaluation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stop an evaluation and its processing"""
    try:
        evaluation_uuid = UUID(evaluation_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify evaluation access
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == user_uuid
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied"
        )
    
    try:
        # Stop the evaluation processing
        result = await evaluation_manager.stop_evaluation(evaluation_uuid)
        
        print(f"[EvaluationsAPI] ✅ Stopped evaluation {evaluation_id}")
        
        return {
            'success': True,
            'evaluation_id': str(evaluation_uuid),
            'message': 'Evaluation stopped successfully',
            'result': result
        }
        
    except Exception as e:
        logger.error(f"Failed to stop evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop evaluation: {str(e)}"
        )

@router.delete("/{evaluation_id}")
async def delete_evaluation(
    evaluation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an evaluation and all its cleaned turns"""
    try:
        evaluation_uuid = UUID(evaluation_id)
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format"
        )
    
    # Verify evaluation access
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == user_uuid
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied"
        )
    
    try:
        # Delete evaluation (cascade will delete cleaned turns)
        db.delete(evaluation)
        db.commit()
        
        print(f"[EvaluationsAPI] ✅ Deleted evaluation {evaluation_id}")
        
        return {
            'success': True,
            'evaluation_id': str(evaluation_uuid),
            'message': 'Evaluation deleted successfully'
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete evaluation: {str(e)}"
        )