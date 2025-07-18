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

from app.models.prompt_template import PromptTemplate, PromptUsage, ABTest, ABTestResult, FunctionPromptTemplate
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

Return ONLY the cleaned text as a raw string. Do not include any JSON formatting or metadata.

IMPORTANT: 
- If text needs no cleaning, return the original text unchanged
- Be conservative - when in doubt, preserve original meaning
- Focus on making speech clear while maintaining authenticity"""

    async def get_or_create_default_template(self, db: Session) -> PromptTemplate:
        """Get the default template or create it if it doesn't exist"""
        template = db.query(PromptTemplate).filter(
            PromptTemplate.name == "Default CleanerContext Template"
        ).first()
        
        if not template:
            # Check if any template is already default
            existing_default = db.query(PromptTemplate).filter(
                PromptTemplate.is_default == True
            ).first()
            
            template = PromptTemplate(
                name="Default CleanerContext Template",
                template=self.default_template,
                description="The original system prompt for conversation cleaning",
                variables=["conversation_context", "raw_text", "cleaning_level"],
                version="1.0.0",
                is_default=existing_default is None  # Only set as default if no other default exists
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

    async def get_templates(self, db: Session) -> List[PromptTemplate]:
        """Get all prompt templates"""
        try:
            return db.query(PromptTemplate).order_by(desc(PromptTemplate.updated_at)).all()
        except Exception as e:
            logger.warning(f"Database query failed: {str(e)}")
            # Return empty list if database is unavailable
            return []

    async def get_template(self, db: Session, template_id: UUID) -> Optional[PromptTemplate]:
        """Get a specific template by ID"""
        return db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    
    def get_template_by_id_sync(self, template_id: UUID, db: Session) -> Optional[PromptTemplate]:
        """Get template by ID (sync version for caching)"""
        return db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()

    async def update_template(self, db: Session, template_id: UUID, 
                            **updates) -> Optional[PromptTemplate]:
        """Update a prompt template"""
        template = await self.get_template(db, template_id)
        if not template:
            return None
        
        # Handle is_default updates with constraint enforcement
        if 'is_default' in updates:
            if updates['is_default'] is True:
                # If setting this template as default, unset all other defaults
                await self._ensure_single_default(db, template_id)
            elif updates['is_default'] is False:
                # If unsetting as default, ensure we have at least one default
                if template.is_default:
                    await self._ensure_at_least_one_default(db, template_id)
        
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
    
    async def delete_template(self, db: Session, template_id: UUID) -> bool:
        """Delete a prompt template with constraint enforcement"""
        template = await self.get_template(db, template_id)
        if not template:
            return False
        
        # Check if this is the last template
        total_templates = db.query(PromptTemplate).count()
        if total_templates <= 1:
            raise ValueError("Cannot delete the last remaining prompt template")
        
        # If deleting the default template, ensure another one becomes default
        if template.is_default:
            await self._ensure_at_least_one_default(db, template_id)
        
        db.delete(template)
        db.commit()
        
        logger.info(f"Deleted template: {template_id}")
        return True
    
    async def set_default_template(self, db: Session, template_id: UUID) -> Optional[PromptTemplate]:
        """Set a template as the default (and unset all others)"""
        template = await self.get_template(db, template_id)
        if not template:
            return None
        
        # Use the constraint-enforced update method
        return await self.update_template(db, template_id, is_default=True)
    
    async def get_default_template(self, db: Session) -> Optional[PromptTemplate]:
        """Get the current default template"""
        return db.query(PromptTemplate).filter(PromptTemplate.is_default == True).first()
    
    async def _ensure_single_default(self, db: Session, new_default_id: UUID) -> None:
        """Ensure only one template is marked as default"""
        # Unset all other templates as default
        db.query(PromptTemplate).filter(
            PromptTemplate.id != new_default_id,
            PromptTemplate.is_default == True
        ).update({PromptTemplate.is_default: False})
        db.commit()
        logger.info(f"Unset other templates as default, setting {new_default_id} as default")
    
    async def _ensure_at_least_one_default(self, db: Session, excluding_id: UUID) -> None:
        """Ensure at least one template remains as default"""
        # Count remaining default templates (excluding the one being changed)
        remaining_defaults = db.query(PromptTemplate).filter(
            PromptTemplate.id != excluding_id,
            PromptTemplate.is_default == True
        ).count()
        
        if remaining_defaults == 0:
            # Find the next available template to set as default
            next_template = db.query(PromptTemplate).filter(
                PromptTemplate.id != excluding_id
            ).order_by(PromptTemplate.created_at.asc()).first()
            
            if next_template:
                next_template.is_default = True
                db.commit()
                logger.info(f"Set {next_template.id} as default to ensure at least one default exists")
            else:
                raise ValueError("Cannot unset default: no other templates available")

    # Function Prompt Template Methods
    
    async def get_function_templates(self, db: Session) -> List[FunctionPromptTemplate]:
        """Get all function prompt templates"""
        return db.query(FunctionPromptTemplate).order_by(FunctionPromptTemplate.created_at.desc()).all()
    
    async def get_function_template(self, db: Session, template_id: UUID) -> Optional[FunctionPromptTemplate]:
        """Get a specific function prompt template"""
        return db.query(FunctionPromptTemplate).filter(FunctionPromptTemplate.id == template_id).first()
    
    async def create_function_template(
        self, 
        db: Session, 
        name: str, 
        description: str, 
        template: str, 
        variables: List[str]
    ) -> FunctionPromptTemplate:
        """Create a new function prompt template"""
        # Check if name already exists
        existing = db.query(FunctionPromptTemplate).filter(FunctionPromptTemplate.name == name).first()
        if existing:
            raise ValueError(f"Function template with name '{name}' already exists")
        
        # Create the template
        function_template = FunctionPromptTemplate(
            name=name,
            description=description,
            template=template,
            variables=variables
        )
        
        db.add(function_template)
        db.commit()
        db.refresh(function_template)
        
        logger.info(f"Created function template: {name}")
        return function_template
    
    async def update_function_template(
        self, 
        db: Session, 
        template_id: UUID, 
        **updates
    ) -> Optional[FunctionPromptTemplate]:
        """Update a function prompt template"""
        template = await self.get_function_template(db, template_id)
        if not template:
            return None
        
        # Handle is_default constraint
        if updates.get('is_default') == True:
            await self._ensure_single_function_default(db, template_id)
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        db.commit()
        db.refresh(template)
        
        logger.info(f"Updated function template: {template_id}")
        return template
    
    async def delete_function_template(self, db: Session, template_id: UUID) -> bool:
        """Delete a function prompt template"""
        template = await self.get_function_template(db, template_id)
        if not template:
            return False
        
        # Check if this is the last template
        total_templates = db.query(FunctionPromptTemplate).count()
        if total_templates <= 1:
            raise ValueError("Cannot delete the last remaining function template")
        
        # If deleting the default template, ensure another one becomes default
        if template.is_default:
            await self._ensure_at_least_one_function_default(db, template_id)
        
        db.delete(template)
        db.commit()
        
        logger.info(f"Deleted function template: {template_id}")
        return True
    
    async def set_default_function_template(self, db: Session, template_id: UUID) -> Optional[FunctionPromptTemplate]:
        """Set a function template as the default (and unset all others)"""
        template = await self.get_function_template(db, template_id)
        if not template:
            return None
        
        # Use the constraint-enforced update method
        return await self.update_function_template(db, template_id, is_default=True)
    
    async def get_default_function_template(self, db: Session) -> Optional[FunctionPromptTemplate]:
        """Get the current default function template"""
        return db.query(FunctionPromptTemplate).filter(FunctionPromptTemplate.is_default == True).first()
    
    async def _ensure_single_function_default(self, db: Session, new_default_id: UUID) -> None:
        """Ensure only one function template is marked as default"""
        # Unset all other templates as default
        db.query(FunctionPromptTemplate).filter(
            FunctionPromptTemplate.id != new_default_id,
            FunctionPromptTemplate.is_default == True
        ).update({FunctionPromptTemplate.is_default: False})
        db.commit()
        logger.info(f"Unset other function templates as default, setting {new_default_id} as default")
    
    async def _ensure_at_least_one_function_default(self, db: Session, excluding_id: UUID) -> None:
        """Ensure at least one function template remains as default"""
        # Count remaining default templates (excluding the one being changed)
        remaining_defaults = db.query(FunctionPromptTemplate).filter(
            FunctionPromptTemplate.id != excluding_id,
            FunctionPromptTemplate.is_default == True
        ).count()
        
        if remaining_defaults == 0:
            # Find the next available template to set as default
            next_template = db.query(FunctionPromptTemplate).filter(
                FunctionPromptTemplate.id != excluding_id
            ).order_by(FunctionPromptTemplate.created_at.asc()).first()
            
            if next_template:
                next_template.is_default = True
                db.commit()
                logger.info(f"Set {next_template.id} as function default to ensure at least one default exists")
            else:
                raise ValueError("Cannot unset default: no other function templates available")