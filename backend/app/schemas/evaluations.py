"""
Pydantic schemas for evaluation processing API

Defines the exact JSON format for evaluation-based CleanerContext processing
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class CreateEvaluationRequest(BaseModel):
    """Request schema for creating a new evaluation"""
    name: str = Field(..., description="Human-readable name for this evaluation")
    description: Optional[str] = Field(None, description="Optional description of the evaluation approach")
    prompt_template: Optional[str] = Field(None, description="Custom prompt template for this evaluation")
    settings: Optional[Dict[str, Any]] = Field(default={}, description="Evaluation settings (cleaning_level, model_params, etc.)")

class EvaluationResponse(BaseModel):
    """Response schema for evaluation"""
    id: str = Field(..., description="Unique evaluation identifier")
    conversation_id: str = Field(..., description="Conversation identifier")
    name: str = Field(..., description="Evaluation name")
    description: Optional[str] = Field(None, description="Evaluation description")
    prompt_template: Optional[str] = Field(None, description="Prompt template used")
    settings: Dict[str, Any] = Field(default={}, description="Evaluation settings")
    user_id: str = Field(..., description="User who created this evaluation")
    status: str = Field(..., description="Evaluation status")
    turns_processed: int = Field(..., description="Number of turns processed")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")

class ProcessTurnRequest(BaseModel):
    """Request schema for processing a turn in an evaluation"""
    turn_id: str = Field(..., description="ID of the raw turn to process")
    settings: Optional[Dict[str, Any]] = Field(default={}, description="Override settings for this turn")

class CleanedTurnResponse(BaseModel):
    """Response schema for a cleaned turn"""
    id: str = Field(..., description="Unique cleaned turn identifier")
    evaluation_id: str = Field(..., description="Evaluation identifier")
    turn_id: str = Field(..., description="Original raw turn identifier")
    cleaned_text: str = Field(..., description="AI-cleaned text")
    confidence_score: str = Field(..., description="AI confidence: HIGH, MEDIUM, LOW")
    cleaning_applied: bool = Field(..., description="Whether cleaning was applied")
    cleaning_level: str = Field(..., description="Cleaning level used")
    processing_time_ms: float = Field(..., description="Processing time")
    corrections: List[Dict[str, Any]] = Field(default=[], description="Corrections made")
    context_detected: Optional[str] = Field(None, description="Business context detected")
    ai_model_used: Optional[str] = Field(None, description="AI model used")
    created_at: str = Field(..., description="Creation timestamp")
    
    # Raw turn data for reference
    raw_speaker: str = Field(..., description="Original speaker")
    raw_text: str = Field(..., description="Original raw text")
    turn_sequence: int = Field(..., description="Sequential turn number (1, 2, 3, ...)")

class EvaluationDetailsResponse(BaseModel):
    """Detailed evaluation response with cleaned turns"""
    evaluation: EvaluationResponse
    cleaned_turns: List[CleanedTurnResponse]
    conversation_name: str = Field(..., description="Name of the conversation being evaluated")
    total_raw_turns: int = Field(..., description="Total number of raw turns in conversation")

class ListEvaluationsResponse(BaseModel):
    """Response schema for listing evaluations"""
    evaluations: List[EvaluationResponse]
    total: int = Field(..., description="Total number of evaluations")
    page: int = Field(default=1, description="Current page")
    per_page: int = Field(default=20, description="Items per page")