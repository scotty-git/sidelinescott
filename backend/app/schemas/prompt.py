"""
Prompt Engineering Schema - For Prompt Dashboard API
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class PromptTemplate(BaseModel):
    """Core prompt template schema"""
    id: str
    name: str
    template: str
    description: Optional[str] = None
    variables: List[str]  # List of variable names used in template
    version: str = "1.0.0"
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


class PromptVariable(BaseModel):
    """Individual prompt variable with current value"""
    name: str
    value: Any
    data_type: str  # "string", "list", "dict", "number"
    description: Optional[str] = None


class RenderedPrompt(BaseModel):
    """Final prompt with all variables filled in"""
    template_id: str
    template_name: str
    raw_template: str
    rendered_prompt: str
    variables_used: List[PromptVariable]
    token_count: Optional[int] = None
    created_at: datetime


class PromptPerformanceMetrics(BaseModel):
    """Performance data for a prompt version"""
    template_id: str
    total_uses: int
    avg_processing_time_ms: float
    avg_confidence_score: str
    success_rate: float
    correction_rate: float
    context_utilization_rate: float


class ABTestConfig(BaseModel):
    """A/B test configuration"""
    test_id: str
    name: str
    description: Optional[str] = None
    prompt_a_id: str
    prompt_b_id: str
    traffic_split_percent: int = 50  # Percentage for prompt A (B gets remainder)
    is_active: bool = True
    created_at: datetime


class ABTestResult(BaseModel):
    """A/B test results"""
    test_id: str
    prompt_a_metrics: PromptPerformanceMetrics
    prompt_b_metrics: PromptPerformanceMetrics
    statistical_significance: Optional[float] = None
    winner: Optional[str] = None  # "A", "B", or "TIE"


class TurnPromptAnalysis(BaseModel):
    """Analysis of prompt used for a specific turn"""
    turn_id: str
    conversation_id: str
    speaker: str
    raw_text: str
    cleaned_text: str
    template_used: PromptTemplate
    rendered_prompt: RenderedPrompt
    gemini_response: Dict[str, Any]
    processing_time_ms: float
    confidence_score: str
    corrections: List[Dict[str, Any]]


class PromptInsights(BaseModel):
    """Analytics insights for prompt engineering"""
    total_turns_processed: int
    avg_token_usage: float
    most_effective_variables: List[str]
    common_failure_patterns: List[str]
    context_usage_stats: Dict[str, Any]
    model_performance_by_prompt: Dict[str, PromptPerformanceMetrics]


# Request models
class CreatePromptTemplateRequest(BaseModel):
    name: str
    template: str
    description: Optional[str] = None
    variables: List[str]


class UpdatePromptTemplateRequest(BaseModel):
    name: Optional[str] = None
    template: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: Optional[bool] = None


class RenderPromptRequest(BaseModel):
    template_id: str
    variables: Dict[str, Any]


class CreateABTestRequest(BaseModel):
    name: str
    description: Optional[str] = None
    prompt_a_id: str
    prompt_b_id: str
    traffic_split_percent: int = 50


class PromptSimulationRequest(BaseModel):
    """Test a prompt against sample data"""
    template_id: str
    sample_raw_text: str
    sample_speaker: str
    sample_context: List[Dict[str, Any]]
    cleaning_level: str = "full"


class ConversationSimulationRequest(BaseModel):
    """Test a prompt against real conversation data"""
    template_id: str
    conversation_id: UUID
    testing_mode: str = "single_turn"  # "single_turn" or "full_conversation"
    turn_index: Optional[int] = None  # Required for single_turn mode
    custom_variable: Optional[str] = None  # Custom variable for testing


# Test Conversation schemas
class TestConversationResponse(BaseModel):
    """Response schema for test conversations"""
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    variables: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateTestConversationRequest(BaseModel):
    """Request schema for creating test conversations"""
    user_id: UUID
    name: str
    description: Optional[str] = None
    variables: Dict[str, Any]


class UpdateTestConversationRequest(BaseModel):
    """Request schema for updating test conversations"""
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None