"""
Prompt Engineering Service - Core logic for prompt management and analytics
"""

import json
import time
import random
import logging
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.prompt_template import PromptTemplate, PromptUsage, ABTest, ABTestResult
from app.models.test_conversation import TestConversation
from app.schemas.prompt import (
    PromptTemplate as PromptTemplateSchema,
    RenderedPrompt,
    PromptVariable,
    PromptPerformanceMetrics,
    TurnPromptAnalysis,
    PromptInsights
)

logger = logging.getLogger(__name__)


class PromptEngineeringService:
    """Service for managing prompt templates, A/B testing, and analytics"""
    
    def __init__(self):
        logger.info("Initialized Prompt Engineering Service")
        
        # Default prompt template - this is the current system prompt
        self.default_template = """You are an expert conversation cleaner specializing in speech-to-text error correction.

CRITICAL INSTRUCTIONS:
1. Clean ONLY speech-to-text errors, noise, and clarity issues
2. PRESERVE the speaker's original meaning and intent 100%
3. Do NOT add, remove, or change any factual content
4. Do NOT correct business information, names, or domain-specific terms unless clearly wrong
5. Fix only: unclear words, noise artifacts, repetition, filler words, obvious transcription errors

CONTEXT (cleaned conversation history):
{conversation_context}

RAW TEXT TO CLEAN:
"{raw_text}"

CLEANING LEVEL: {cleaning_level}
- light: Fix only obvious STT errors and noise
- full: Fix STT errors, clarity, and minor grammatical issues while preserving meaning

Return ONLY valid JSON in this exact format:
{{
    "cleaned_text": "corrected text here",
    "confidence_score": "HIGH|MEDIUM|LOW",
    "cleaning_applied": true,
    "corrections": [
        {{"original": "original text", "corrected": "corrected text", "confidence": "HIGH|MEDIUM|LOW", "reason": "explanation"}}
    ],
    "context_detected": "business_conversation|casual_chat|technical_discussion"
}}

IMPORTANT: 
- If text needs no cleaning, set cleaning_applied: false and return original text
- Be conservative - when in doubt, preserve original meaning
- Focus on making speech clear while maintaining authenticity"""

    async def get_or_create_default_template(self, db: Session) -> PromptTemplate:
        """Get the default template or create it if it doesn't exist"""
        template = db.query(PromptTemplate).filter(
            PromptTemplate.name == "Default CleanerContext Template"
        ).first()
        
        if not template:
            template = PromptTemplate(
                name="Default CleanerContext Template",
                template=self.default_template,
                description="The original system prompt for conversation cleaning",
                variables=["conversation_context", "raw_text", "cleaning_level"],
                version="1.0.0",
                is_active=True
            )
            db.add(template)
            db.commit()
            db.refresh(template)
            logger.info(f"Created default prompt template: {template.id}")
        
        return template

    async def create_template(self, db: Session, name: str, template: str, 
                            description: Optional[str] = None,
                            variables: Optional[List[str]] = None) -> PromptTemplate:
        """Create a new prompt template"""
        
        # Auto-detect variables if not provided
        if variables is None:
            variables = self._extract_variables(template)
        
        db_template = PromptTemplate(
            name=name,
            template=template,
            description=description,
            variables=variables,
            version="1.0.0"
        )
        
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        
        logger.info(f"Created prompt template: {name} ({db_template.id})")
        return db_template

    def _extract_variables(self, template: str) -> List[str]:
        """Extract variable names from template using {variable_name} pattern"""
        import re
        variables = re.findall(r'{(\w+)}', template)
        return list(set(variables))  # Remove duplicates
    
    def validate_template_variables(self, template_str: str, variables: Dict[str, str]) -> Dict[str, Any]:
        """Validate template variables against 5-variable system - NO auto-fixes"""
        from app.core.variables import SUPPORTED_VARIABLES
        
        detected_vars = self._extract_variables(template_str)
        warnings = []
        errors = []
        
        # Check for unsupported variables
        unsupported = [v for v in detected_vars if v not in SUPPORTED_VARIABLES]
        if unsupported:
            errors.append(f"Unsupported variables: {unsupported}")
        
        # Check for missing required variables
        required_vars = [v for v in detected_vars if SUPPORTED_VARIABLES.get(v, {}).get("required", False)]
        for var_name in required_vars:
            if var_name not in variables or not variables[var_name]:
                errors.append(f"Required variable '{var_name}' is missing or empty")
        
        # Generate warnings for empty optional variables (but don't error)
        for var_name in detected_vars:
            if var_name in variables and not variables[var_name]:
                warnings.append(f"Variable '{var_name}' is empty - will appear blank in prompt")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "detected_variables": detected_vars
        }

    async def get_templates(self, db: Session, include_inactive: bool = False) -> List[PromptTemplate]:
        """Get all prompt templates"""
        try:
            query = db.query(PromptTemplate)
            if not include_inactive:
                query = query.filter(PromptTemplate.is_active == True)
            
            return query.order_by(desc(PromptTemplate.updated_at)).all()
        except Exception as e:
            logger.warning(f"Database query failed: {str(e)}")
            # Return empty list if database is unavailable
            return []

    async def get_template(self, db: Session, template_id: UUID) -> Optional[PromptTemplate]:
        """Get a specific template by ID"""
        return db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()

    async def update_template(self, db: Session, template_id: UUID, 
                            **updates) -> Optional[PromptTemplate]:
        """Update a prompt template"""
        template = await self.get_template(db, template_id)
        if not template:
            return None
        
        for key, value in updates.items():
            if hasattr(template, key) and value is not None:
                setattr(template, key, value)
        
        # Re-extract variables if template was updated
        if 'template' in updates:
            template.variables = self._extract_variables(template.template)
        
        db.commit()
        db.refresh(template)
        
        logger.info(f"Updated template: {template.name}")
        return template

    async def set_active_template(self, db: Session, template_id: UUID) -> bool:
        """Set a template as the active one (deactivate others)"""
        # Deactivate all templates
        db.query(PromptTemplate).update({PromptTemplate.is_active: False})
        
        # Activate the selected template
        template = await self.get_template(db, template_id)
        if not template:
            return False
        
        template.is_active = True
        db.commit()
        
        logger.info(f"Set active template: {template.name}")
        return True

    async def render_prompt(self, db: Session, template_id: UUID, 
                          variables: Dict[str, Any]) -> Optional[RenderedPrompt]:
        """Render prompt with pure variable substitution and validation"""
        template = await self.get_template(db, template_id)
        if not template:
            return None
        
        # Validate template against 5-variable system
        validation = self.validate_template_variables(template.template, variables)
        if not validation["valid"]:
            logger.error(f"Template validation failed: {validation['errors']}")
            return None
        
        # Log warnings to console (don't block)
        if validation["warnings"]:
            logger.warning(f"Template warnings: {validation['warnings']}")
        
        try:
            # Pure substitution - no additions, no defaults
            rendered = template.template.format(**variables)
            
            # Convert variables to PromptVariable objects
            prompt_variables = [
                PromptVariable(
                    name=name,
                    value=value,
                    data_type=type(value).__name__,
                    description=f"Value used for {name}"
                )
                for name, value in variables.items()
            ]
            
            rendered_prompt = RenderedPrompt(
                template_id=str(template.id),
                template_name=template.name,
                raw_template=template.template,
                rendered_prompt=rendered,
                variables_used=prompt_variables,
                token_count=len(rendered.split()) * 1.3,  # Rough token estimate
                created_at=time.time()
            )
            
            return rendered_prompt
            
        except KeyError as e:
            logger.error(f"Missing variable for template {template_id}: {e}")
            return None

    async def log_prompt_usage(self, db: Session, template_id: UUID, 
                             rendered_prompt: str, variables: Dict[str, Any],
                             turn_id: Optional[UUID] = None,
                             conversation_id: Optional[UUID] = None,
                             processing_time_ms: Optional[float] = None,
                             confidence_score: Optional[str] = None,
                             corrections_count: int = 0) -> PromptUsage:
        """Log usage of a prompt template"""
        
        usage = PromptUsage(
            template_id=template_id,
            turn_id=turn_id,
            conversation_id=conversation_id,
            rendered_prompt=rendered_prompt,
            variables_used=variables,
            token_count=len(rendered_prompt.split()) * 1.3,  # Rough estimate
            processing_time_ms=processing_time_ms,
            confidence_score=confidence_score,
            corrections_count=corrections_count,
            context_turns_used=len(variables.get('conversation_context', '').split('\n')) if 'conversation_context' in variables else 0
        )
        
        db.add(usage)
        db.commit()
        db.refresh(usage)
        
        return usage

    async def get_turn_prompt_analysis(self, db: Session, turn_id: UUID) -> Optional[TurnPromptAnalysis]:
        """Get detailed prompt analysis for a specific turn"""
        
        # Get the prompt usage for this turn
        usage = db.query(PromptUsage).filter(PromptUsage.turn_id == turn_id).first()
        if not usage:
            return None
        
        template = await self.get_template(db, usage.template_id)
        if not template:
            return None
        
        # This would need to be filled from the actual turn data
        # For now, we'll return a mock structure
        return TurnPromptAnalysis(
            turn_id=str(turn_id),
            conversation_id=str(usage.conversation_id) if usage.conversation_id else "",
            speaker="User",  # Would come from turn data
            raw_text="",     # Would come from turn data
            cleaned_text="", # Would come from turn data
            template_used=template,
            rendered_prompt=RenderedPrompt(
                template_id=str(template.id),
                template_name=template.name,
                raw_template=template.template,
                rendered_prompt=usage.rendered_prompt,
                variables_used=[],
                created_at=usage.created_at
            ),
            gemini_response={},  # Would come from turn data
            processing_time_ms=usage.processing_time_ms or 0,
            confidence_score=usage.confidence_score or "UNKNOWN",
            corrections=[]       # Would come from turn data
        )

    async def get_template_performance(self, db: Session, 
                                     template_id: UUID) -> PromptPerformanceMetrics:
        """Get performance metrics for a template"""
        
        usages = db.query(PromptUsage).filter(
            PromptUsage.template_id == template_id
        ).all()
        
        if not usages:
            return PromptPerformanceMetrics(
                template_id=str(template_id),
                total_uses=0,
                avg_processing_time_ms=0,
                avg_confidence_score="UNKNOWN",
                success_rate=0,
                correction_rate=0,
                context_utilization_rate=0
            )
        
        total_uses = len(usages)
        processing_times = [u.processing_time_ms for u in usages if u.processing_time_ms]
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
        
        # Calculate confidence distribution
        confidence_scores = [u.confidence_score for u in usages if u.confidence_score]
        high_confidence = len([c for c in confidence_scores if c == "HIGH"])
        avg_confidence = "HIGH" if high_confidence / len(confidence_scores) > 0.6 else "MEDIUM" if confidence_scores else "UNKNOWN"
        
        corrections_made = [u.corrections_count for u in usages if u.corrections_count > 0]
        correction_rate = len(corrections_made) / total_uses if total_uses > 0 else 0
        
        context_used = [u.context_turns_used for u in usages if u.context_turns_used > 0]
        context_utilization_rate = len(context_used) / total_uses if total_uses > 0 else 0
        
        return PromptPerformanceMetrics(
            template_id=str(template_id),
            total_uses=total_uses,
            avg_processing_time_ms=avg_processing_time,
            avg_confidence_score=avg_confidence,
            success_rate=0.95,  # Would calculate from success/failure tracking
            correction_rate=correction_rate,
            context_utilization_rate=context_utilization_rate
        )

    async def create_ab_test(self, db: Session, name: str, 
                           prompt_a_id: UUID, prompt_b_id: UUID,
                           description: Optional[str] = None,
                           traffic_split: int = 50) -> ABTest:
        """Create a new A/B test"""
        
        ab_test = ABTest(
            name=name,
            description=description,
            prompt_a_id=prompt_a_id,
            prompt_b_id=prompt_b_id,
            traffic_split_percent=traffic_split
        )
        
        db.add(ab_test)
        db.commit()
        db.refresh(ab_test)
        
        logger.info(f"Created A/B test: {name} ({ab_test.id})")
        return ab_test

    async def get_active_ab_test(self, db: Session) -> Optional[ABTest]:
        """Get the currently active A/B test"""
        return db.query(ABTest).filter(ABTest.is_active == True).first()

    async def select_prompt_for_ab_test(self, db: Session, 
                                      ab_test: ABTest) -> Tuple[UUID, str]:
        """Select which prompt to use based on A/B test configuration"""
        
        # Use traffic split to determine which prompt variant
        if random.randint(1, 100) <= ab_test.traffic_split_percent:
            return ab_test.prompt_a_id, "A"
        else:
            return ab_test.prompt_b_id, "B"

    async def log_ab_test_result(self, db: Session, test_id: UUID, variant: str,
                               turn_id: Optional[UUID] = None,
                               processing_time_ms: Optional[float] = None,
                               confidence_score: Optional[str] = None,
                               corrections_count: int = 0,
                               success: bool = True) -> ABTestResult:
        """Log results from an A/B test"""
        
        result = ABTestResult(
            test_id=test_id,
            prompt_variant=variant,
            turn_id=turn_id,
            processing_time_ms=processing_time_ms,
            confidence_score=confidence_score,
            corrections_count=corrections_count,
            success=success
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return result

    async def get_prompt_insights(self, db: Session) -> PromptInsights:
        """Get comprehensive insights for prompt engineering"""
        
        total_usage_count = db.query(func.count(PromptUsage.id)).scalar() or 0
        
        # Calculate average token usage
        avg_tokens = db.query(func.avg(PromptUsage.token_count)).scalar() or 0
        
        return PromptInsights(
            total_turns_processed=total_usage_count,
            avg_token_usage=float(avg_tokens),
            most_effective_variables=["conversation_context", "cleaning_level"],  # Would calculate from data
            common_failure_patterns=["Missing context", "Long input text"],      # Would calculate from data
            context_usage_stats={
                "avg_context_turns": 3.5,
                "context_utilization_rate": 0.75
            },
            model_performance_by_prompt={}  # Would populate with template performance data
        )

    # Test Conversation Management Methods
    
    async def create_test_conversation(self, db: Session, user_id: UUID, name: str, 
                                     description: Optional[str] = None,
                                     variables: Dict[str, Any] = None) -> TestConversation:
        """Create a new test conversation"""
        if variables is None:
            variables = {}
            
        test_conversation = TestConversation(
            user_id=user_id,
            name=name,
            description=description,
            variables=variables
        )
        
        db.add(test_conversation)
        db.commit()
        db.refresh(test_conversation)
        
        logger.info(f"Created test conversation: {name} ({test_conversation.id})")
        return test_conversation

    async def get_test_conversations(self, db: Session, user_id: Optional[UUID] = None) -> List[TestConversation]:
        """Get all test conversations, optionally filtered by user"""
        query = db.query(TestConversation)
        
        if user_id:
            query = query.filter(TestConversation.user_id == user_id)
        
        return query.order_by(desc(TestConversation.updated_at)).all()

    async def get_test_conversation(self, db: Session, test_conversation_id: UUID) -> Optional[TestConversation]:
        """Get a specific test conversation by ID"""
        return db.query(TestConversation).filter(TestConversation.id == test_conversation_id).first()

    async def update_test_conversation(self, db: Session, test_conversation_id: UUID, 
                                     **updates) -> Optional[TestConversation]:
        """Update a test conversation with the provided fields"""
        test_conversation = db.query(TestConversation).filter(TestConversation.id == test_conversation_id).first()
        
        if not test_conversation:
            return None
        
        for key, value in updates.items():
            if hasattr(test_conversation, key):
                setattr(test_conversation, key, value)
        
        db.commit()
        db.refresh(test_conversation)
        
        logger.info(f"Updated test conversation: {test_conversation.id}")
        return test_conversation

    async def delete_test_conversation(self, db: Session, test_conversation_id: UUID) -> bool:
        """Delete a test conversation"""
        test_conversation = db.query(TestConversation).filter(TestConversation.id == test_conversation_id).first()
        
        if not test_conversation:
            return False
        
        db.delete(test_conversation)
        db.commit()
        
        logger.info(f"Deleted test conversation: {test_conversation_id}")
        return True