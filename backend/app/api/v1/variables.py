"""
Variable suggestions API - Manage user variable history and suggestions

Provides endpoints for saving and retrieving user's previously used prompt template variables.
"""

import logging
from datetime import datetime
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user_variable_history import UserVariableHistory

router = APIRouter()
logger = logging.getLogger(__name__)


class SaveVariableRequest(BaseModel):
    """Request schema for saving a variable value"""
    variable_name: str
    variable_value: str


class VariableSuggestionResponse(BaseModel):
    """Response schema for variable suggestions"""
    variable_name: str
    suggestions: List[str]


@router.get("/{variable_name}/suggestions", response_model=List[str])
async def get_variable_suggestions(
    variable_name: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's previously used values for a specific variable"""
    print(f"[VariablesAPI] Getting suggestions for variable: {variable_name}")
    
    try:
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Validate variable name
    valid_variables = ['call_context', 'additional_context']
    if variable_name not in valid_variables:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variable name. Must be one of: {valid_variables}"
        )
    
    try:
        # Get user's variable history, ordered by most recent first
        suggestions = db.query(UserVariableHistory).filter(
            UserVariableHistory.user_id == user_uuid,
            UserVariableHistory.variable_name == variable_name
        ).order_by(UserVariableHistory.used_at.desc()).limit(limit).all()
        
        suggestion_values = [s.variable_value for s in suggestions]
        
        print(f"[VariablesAPI] Found {len(suggestion_values)} suggestions for {variable_name}")
        return suggestion_values
        
    except Exception as e:
        logger.error(f"Failed to get variable suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get suggestions: {str(e)}"
        )


@router.post("/{variable_name}")
async def save_variable_value(
    variable_name: str,
    request: SaveVariableRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a user's variable value for future suggestions"""
    print(f"[VariablesAPI] Saving variable: {variable_name} = '{request.variable_value[:50]}...'")
    
    try:
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Validate variable name
    valid_variables = ['call_context', 'additional_context']
    if variable_name not in valid_variables:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variable name. Must be one of: {valid_variables}"
        )
    
    # Validate that the variable value is not empty
    if not request.variable_value.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variable value cannot be empty"
        )
    
    try:
        # Check if this exact combination already exists
        existing = db.query(UserVariableHistory).filter(
            UserVariableHistory.user_id == user_uuid,
            UserVariableHistory.variable_name == variable_name,
            UserVariableHistory.variable_value == request.variable_value
        ).first()
        
        if existing:
            # Update the used_at timestamp
            existing.used_at = datetime.utcnow()
            print(f"[VariablesAPI] Updated existing variable entry")
        else:
            # Create new entry
            variable_history = UserVariableHistory(
                user_id=user_uuid,
                variable_name=variable_name,
                variable_value=request.variable_value
            )
            db.add(variable_history)
            print(f"[VariablesAPI] Created new variable entry")
        
        db.commit()
        
        return {
            "success": True,
            "variable_name": variable_name,
            "message": "Variable value saved successfully"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save variable value: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save variable value: {str(e)}"
        )


@router.get("/all-suggestions")
async def get_all_variable_suggestions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get suggestions for all variables that the user has used"""
    try:
        user_uuid = UUID(current_user["id"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    try:
        # Get all variable history for this user
        history = db.query(UserVariableHistory).filter(
            UserVariableHistory.user_id == user_uuid
        ).order_by(UserVariableHistory.used_at.desc()).all()
        
        # Group by variable name
        suggestions_by_variable = {}
        for entry in history:
            if entry.variable_name not in suggestions_by_variable:
                suggestions_by_variable[entry.variable_name] = []
            
            # Add to suggestions if not already there (maintain order)
            if entry.variable_value not in suggestions_by_variable[entry.variable_name]:
                suggestions_by_variable[entry.variable_name].append(entry.variable_value)
        
        # Limit to 10 suggestions per variable
        for variable_name in suggestions_by_variable:
            suggestions_by_variable[variable_name] = suggestions_by_variable[variable_name][:10]
        
        print(f"[VariablesAPI] Retrieved suggestions for {len(suggestions_by_variable)} variables")
        return suggestions_by_variable
        
    except Exception as e:
        logger.error(f"Failed to get all variable suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all suggestions: {str(e)}"
        )