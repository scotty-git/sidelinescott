"""
Function Caller Schemas - Request/response models for function calling
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class FunctionCallRequest(BaseModel):
    """Request to execute a function call"""
    name: str = Field(..., description="Name of the function to call")
    parameters: Dict[str, Any] = Field(..., description="Parameters for the function")


class FunctionCallResult(BaseModel):
    """Result of a function call execution"""
    function_name: str
    parameters: Dict[str, Any]
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float
    changes_made: List[Dict[str, Any]] = Field(default_factory=list)


class FunctionDecisionRequest(BaseModel):
    """Request to get function calling decision from AI"""
    cleaned_text: str = Field(..., description="The cleaned text to analyze")
    call_context: Dict[str, Any] = Field(..., description="Current customer state")
    cleaned_conversation: str = Field(..., description="Recent conversation history")
    available_functions: str = Field(..., description="JSON string of available functions")
    previous_function_calls: str = Field(..., description="JSON string of previous function calls")


class FunctionDecisionResponse(BaseModel):
    """Response from AI function calling decision"""
    thought_process: str = Field(..., description="AI reasoning for the decision")
    function_calls: List[FunctionCallRequest] = Field(default_factory=list)
    confidence_score: str = Field(default="MEDIUM", description="Confidence in the decision")


class CalledFunctionResponse(BaseModel):
    """Response model for a called function record"""
    id: UUID
    evaluation_id: UUID
    turn_id: UUID
    function_name: str
    parameters: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    executed: bool
    confidence_score: Optional[str]
    decision_reasoning: Optional[str]
    processing_time_ms: float
    timing_breakdown: Optional[Dict[str, Any]]
    function_template_id: Optional[UUID]
    gemini_prompt: Optional[str]
    gemini_response: Optional[str]
    template_variables: Optional[Dict[str, Any]]
    mock_data_before: Optional[Dict[str, Any]]
    mock_data_after: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class FunctionCallHistoryResponse(BaseModel):
    """Response for function call history"""
    function_calls: List[CalledFunctionResponse]
    total_count: int
    evaluation_id: UUID


class FunctionExecutionMetrics(BaseModel):
    """Metrics for function execution performance"""
    total_executions: int
    successful_executions: int
    failed_executions: int
    avg_execution_time: float
    max_execution_time: float
    min_execution_time: float
    success_rate: float


class FunctionRegistryResponse(BaseModel):
    """Response model for function registry information"""
    available_functions: List[Dict[str, Any]]
    total_functions: int
    function_names: List[str]


class FunctionValidationRequest(BaseModel):
    """Request to validate a function call"""
    function_name: str
    parameters: Dict[str, Any]


class FunctionValidationResponse(BaseModel):
    """Response for function call validation"""
    is_valid: bool
    validation_message: str
    function_spec: Optional[Dict[str, Any]] = None


class MockCustomerStateResponse(BaseModel):
    """Response model for mock customer state"""
    user_name: str
    job_title: str
    company_name: str
    company_description: str
    company_size: str
    company_sector: str
    business_insights: Dict[str, Any]
    last_updated: datetime


class BusinessInsightUpdate(BaseModel):
    """Request to update business insights"""
    insights: Dict[str, Any] = Field(..., description="New insights to add")
    append_mode: bool = Field(True, description="Whether to append to existing insights or replace")


class FunctionCallStatsResponse(BaseModel):
    """Statistics about function calls for an evaluation"""
    evaluation_id: UUID
    total_function_calls: int
    successful_calls: int
    failed_calls: int
    functions_used: List[str]
    avg_processing_time: float
    last_function_call: Optional[datetime]


class EvaluationFunctionSummary(BaseModel):
    """Summary of function calling for an evaluation"""
    evaluation_id: UUID
    evaluation_name: str
    total_turns_processed: int
    turns_with_function_calls: int
    total_function_calls: int
    unique_functions_called: List[str]
    customer_changes_made: int
    insights_collected: int
    last_activity: Optional[datetime]

    class Config:
        from_attributes = True