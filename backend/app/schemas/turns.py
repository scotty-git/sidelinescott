"""
Pydantic schemas for turn processing API

Defines the exact JSON format for CleanerContext turn processing
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class ContextTurn(BaseModel):
    """Context turn for preview processing"""
    speaker: str = Field(..., description="Speaker name")
    cleaned_text: str = Field(..., description="Previously cleaned text")

class TurnCreateRequest(BaseModel):
    """Request schema for creating a new turn"""
    speaker: str = Field(..., description="Speaker name (User, Lumen, etc.)")
    raw_text: str = Field(..., description="Original text input")
    context: Optional[List[ContextTurn]] = Field(default=[], description="Previous cleaned turns for context (preview mode)")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Optional metadata including sliding_window and cleaning_level")

class CorrectionItem(BaseModel):
    """Individual correction made during cleaning"""
    original: str = Field(..., description="Original text that was corrected")
    corrected: str = Field(..., description="Corrected text")
    confidence: str = Field(..., description="Confidence level: HIGH, MEDIUM, LOW")
    reason: str = Field(..., description="Reason for correction")

class TurnMetadata(BaseModel):
    """CleanerContext metadata for a processed turn"""
    confidence_score: str = Field(..., description="Overall confidence: HIGH, MEDIUM, LOW")
    cleaning_applied: bool = Field(..., description="Whether any cleaning was applied")
    cleaning_level: str = Field(..., description="Cleaning level: none, light, full")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    timing_breakdown: Optional[Dict[str, float]] = Field(default={}, description="Detailed timing breakdown by operation")
    corrections: List[CorrectionItem] = Field(default=[], description="List of corrections made")
    context_detected: Optional[str] = Field(None, description="Business context detected")
    ai_model_used: Optional[str] = Field(None, description="AI model used for processing")
    gemini_prompt: Optional[str] = Field(None, description="Full prompt sent to Gemini API")
    gemini_response: Optional[str] = Field(None, description="Raw response received from Gemini API")

class TurnResponse(BaseModel):
    """Response schema for processed turn"""
    turn_id: str = Field(..., description="Unique turn identifier")
    conversation_id: str = Field(..., description="Conversation identifier")
    speaker: str = Field(..., description="Speaker name")
    raw_text: str = Field(..., description="Original input text")
    cleaned_text: str = Field(..., description="AI-cleaned text")
    metadata: TurnMetadata = Field(..., description="CleanerContext processing metadata")
    created_at: str = Field(..., description="Turn creation timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "turn_id": "123e4567-e89b-12d3-a456-426614174000",
                "conversation_id": "123e4567-e89b-12d3-a456-426614174001",
                "speaker": "User",
                "raw_text": "I'm the vector of Marketing",
                "cleaned_text": "I'm the Director of Marketing",
                "metadata": {
                    "confidence_score": "HIGH",
                    "cleaning_applied": True,
                    "cleaning_level": "full",
                    "processing_time_ms": 245.5,
                    "corrections": [
                        {
                            "original": "vector of",
                            "corrected": "Director of", 
                            "confidence": "HIGH",
                            "reason": "stt_error_pattern"
                        }
                    ],
                    "context_detected": "identity_discussion",
                    "ai_model_used": "gemini-pro"
                },
                "created_at": "2025-01-07T12:05:00Z"
            }
        }