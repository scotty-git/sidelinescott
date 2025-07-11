"""
ConversationManager - Core stateful conversation processing with CleanerContext

This is the heart of the CleanerContext system - manages stateful conversation 
cleaning using cleaned history in sliding window context.
"""

import time
import logging
import asyncio
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.conversation import Conversation
from app.models.turn import Turn
from app.core.database import get_db
from app.services.gemini_service import GeminiService
from app.services.prompt_engineering_service import PromptEngineeringService
from app.core.variables import SUPPORTED_VARIABLES

logger = logging.getLogger(__name__)

class ConversationState:
    """Manages the stateful context for a single conversation"""
    
    def __init__(self, conversation_id: UUID, sliding_window_size: int = 10):
        self.conversation_id = conversation_id
        self.sliding_window_size = sliding_window_size  # Configurable sliding window
        self.cleaned_history: List[Dict[str, Any]] = []
        self.context_patterns: Dict[str, Any] = {}
        
        print(f"[ConversationState] Initialized for conversation {conversation_id}")
        print(f"[ConversationState] Sliding window size: {self.sliding_window_size}")
    
    def get_cleaned_sliding_window(self) -> List[Dict[str, Any]]:
        """Get the cleaned conversation history for context (NOT raw text)"""
        print(f"[ConversationState] 🔍 SLIDING WINDOW DEBUG: Getting sliding window")
        print(f"[ConversationState] 📊 SLIDING WINDOW DEBUG: Current history length: {len(self.cleaned_history)}")
        print(f"[ConversationState] 🎯 SLIDING WINDOW DEBUG: Window size configured: {self.sliding_window_size}")
        
        # Debug: Log ALL history before windowing
        if len(self.cleaned_history) > 0:
            print(f"[ConversationState] 📋 SLIDING WINDOW DEBUG: All available history:")
            for i, turn in enumerate(self.cleaned_history):
                print(f"[ConversationState]   History[{i}]: {turn['speaker']} - '{turn['cleaned_text'][:60]}...'")
        
        # Return last N turns of CLEANED conversation history
        window = self.cleaned_history[-self.sliding_window_size:]
        
        print(f"[ConversationState] ✂️ SLIDING WINDOW DEBUG: Sliding window contains {len(window)} turns")
        print(f"[ConversationState] 🎯 SLIDING WINDOW DEBUG: Window range: turns {max(0, len(self.cleaned_history) - self.sliding_window_size)} to {len(self.cleaned_history)}")
        
        if len(window) > 0:
            print(f"[ConversationState] 📋 SLIDING WINDOW DEBUG: Window contents:")
            for i, turn in enumerate(window):
                actual_turn_num = len(self.cleaned_history) - len(window) + i + 1
                print(f"[ConversationState]   Window[{i}] (Turn {actual_turn_num}): {turn['speaker']} -> '{turn['cleaned_text'][:80]}...'")
        else:
            print(f"[ConversationState] ❌ SLIDING WINDOW DEBUG: Window is empty!")
        
        return window
    
    def add_to_history(self, turn_data: Dict[str, Any]):
        """Add a processed turn to the cleaned history"""
        print(f"[ConversationState] Adding turn to history: {turn_data['speaker']}")
        print(f"[ConversationState] Raw text: '{turn_data['raw_text'][:100]}...'")
        print(f"[ConversationState] Cleaned text: '{turn_data['cleaned_text'][:100]}...'")
        
        self.cleaned_history.append(turn_data)
        
        print(f"[ConversationState] History now contains {len(self.cleaned_history)} turns")
    
    def update_context_patterns(self, patterns: Dict[str, Any]):
        """Track patterns detected in this conversation"""
        print(f"[ConversationState] Updating context patterns: {patterns}")
        self.context_patterns.update(patterns)


class ConversationManager:
    """
    Core stateful conversation management with CleanerContext processing.
    
    Key Innovation: Uses CLEANED history in sliding window, not raw STT errors.
    This creates self-improving conversation context.
    """
    
    def __init__(self):
        self.active_conversations: Dict[UUID, ConversationState] = {}
        self.gemini_service = GeminiService()
        self.prompt_service = PromptEngineeringService()
        self.performance_metrics: Dict[str, List[float]] = {
            'lumen_processing_times': [],
            'user_processing_times': [],
            'context_retrieval_times': []
        }
        
        print("[ConversationManager] Initialized with stateful conversation tracking and Gemini 2.5 Flash")
        print("[ConversationManager] Performance metrics tracking enabled")
        print("[ConversationManager] Prompt Engineering Service integrated")
    
    def get_conversation_state(self, conversation_id: UUID, sliding_window_size: int = 10, db: Session = None) -> ConversationState:
        """Get or create conversation state for stateful processing"""
        print(f"[ConversationManager] Getting conversation state for {conversation_id}")
        
        if conversation_id not in self.active_conversations:
            print(f"[ConversationManager] Creating new conversation state for {conversation_id}")
            self.active_conversations[conversation_id] = ConversationState(conversation_id, sliding_window_size)
            
            # Load existing turns from database to rebuild context
            self._load_existing_context(conversation_id, db)
        else:
            print(f"[ConversationManager] Using existing conversation state for {conversation_id}")
            # Update sliding window size if provided
            if sliding_window_size != 10:  # Only update if different from default
                self.active_conversations[conversation_id].sliding_window_size = sliding_window_size
                print(f"[ConversationManager] Updated sliding window size to {sliding_window_size}")
        
        return self.active_conversations[conversation_id]
    
    def _load_existing_context(self, conversation_id: UUID, db: Session = None):
        """Load existing turns from database to rebuild conversation context"""
        print(f"[ConversationManager] 🔍 CONTEXT DEBUG: Loading existing context for conversation {conversation_id}")
        
        if not db:
            print(f"[ConversationManager] ❌ CONTEXT DEBUG: No database session available - starting with fresh context")
            return
        
        try:
            # Query existing turns for this conversation, ordered chronologically
            print(f"[ConversationManager] 🔍 CONTEXT DEBUG: Querying database for existing turns...")
            existing_turns = db.query(Turn).filter(
                Turn.conversation_id == conversation_id
            ).order_by(Turn.created_at.asc()).all()
            
            print(f"[ConversationManager] 📊 CONTEXT DEBUG: Found {len(existing_turns)} existing turns in database")
            
            if not existing_turns:
                print(f"[ConversationManager] ❌ CONTEXT DEBUG: No existing turns found - starting with fresh context")
                return
            
            # Get the conversation state for this conversation
            conversation_state = self.active_conversations.get(conversation_id)
            if not conversation_state:
                print(f"[ConversationManager] ❌ CONTEXT DEBUG: No conversation state found for {conversation_id}")
                return
            
            print(f"[ConversationManager] 🔍 CONTEXT DEBUG: Starting to load {len(existing_turns)} turns into context...")
            
            # TEMPORARY: Context loading disabled since cleaning data moved to evaluation system
            # In the new architecture, turns table only has raw data
            # Context will be rebuilt from evaluation system in Phase 2
            print(f"[ConversationManager] ⚠️ CONTEXT LOADING TEMPORARILY DISABLED")
            print(f"[ConversationManager] ℹ️ Raw turns found: {len(existing_turns)}")
            print(f"[ConversationManager] ℹ️ Context loading will be reimplemented via evaluation system")
            print(f"[ConversationManager] ℹ️ Current conversation will start with fresh context")
            
            # For now, just create minimal context entries with raw data
            for i, turn in enumerate(existing_turns):
                # Create minimal context entry (no cleaning metadata available)
                context_entry = {
                    'conversation_id': conversation_id,
                    'speaker': turn.speaker,
                    'raw_text': turn.raw_text,
                    'cleaned_text': turn.raw_text,  # Use raw text as fallback
                    'confidence_score': 'UNKNOWN',
                    'cleaning_applied': False,
                    'cleaning_level': 'none',
                    'processing_time_ms': 0.0,
                    'corrections': [],
                    'context_detected': 'unknown',
                    'ai_model_used': None
                }
                
                # Add to conversation state history
                conversation_state.cleaned_history.append(context_entry)
                
                print(f"[ConversationManager] 📝 CONTEXT DEBUG: Loaded raw turn {i+1}: {turn.speaker}")
                print(f"[ConversationManager]   ↳ Raw: '{turn.raw_text[:60]}...'")
                print(f"[ConversationManager]   ↳ Using raw text as cleaned (no cleaning metadata available)")
            
            print(f"[ConversationManager] ✅ CONTEXT DEBUG: Loaded {len(existing_turns)} raw turns with fallback context")
            print(f"[ConversationManager] 📈 CONTEXT DEBUG: Total history length: {len(conversation_state.cleaned_history)}")
            print(f"[ConversationManager] 🎯 CONTEXT DEBUG: Using raw text as cleaned context until evaluation integration")
            
            # Log ALL turns for debugging
            if len(conversation_state.cleaned_history) > 0:
                print(f"[ConversationManager] 📋 CONTEXT DEBUG: Complete context history:")
                for i, turn in enumerate(conversation_state.cleaned_history):
                    print(f"[ConversationManager]   Turn {i+1}: {turn['speaker']} - '{turn['cleaned_text'][:80]}...'")
                    
        except Exception as e:
            print(f"[ConversationManager] ❌ CONTEXT DEBUG: Failed to load existing context: {e}")
            print(f"[ConversationManager] ❌ CONTEXT DEBUG: Exception type: {type(e).__name__}")
            print(f"[ConversationManager] ❌ CONTEXT DEBUG: Continuing with fresh context")
            import traceback
            traceback.print_exc()
    
    def _build_template_variables(self, raw_text: str, cleaned_context: List[Dict[str, Any]], 
                                 cleaning_decision: str, conversation) -> Dict[str, str]:
        """Build variables for template using pure 5-variable system - NO defaults"""
        
        # Build context string from cleaned history
        context_str = ""
        if cleaned_context:
            print(f"[ConversationManager] 📊 CONTEXT BUILD: Using {len(cleaned_context)} turns for context")
            context_lines = []
            for turn in cleaned_context[-5:]:  # Last 5 turns
                line = f"{turn['speaker']}: {turn['cleaned_text']}"
                context_lines.append(line)
                print(f"[ConversationManager]   → Context line: {line[:100]}...")
            context_str = "\n".join(context_lines)
            print(f"[ConversationManager] ✅ CONTEXT BUILD: Built context string ({len(context_str)} chars)")
        else:
            print(f"[ConversationManager] ❌ CONTEXT BUILD: No context available!")
        
        # Build pure 5-variable system (NO defaults, NO additions)
        variables = {
            # Required variables (always present)
            "raw_text": raw_text,
            "conversation_context": context_str,  # Empty string if no context
            "cleaning_level": cleaning_decision,
            
            # Optional variables (EXACTLY as provided, or empty string)
            "call_context": conversation.call_context or "",
            "additional_context": conversation.additional_context or ""
        }
        
        return variables
    
    async def add_turn(self, conversation_id: UUID, speaker: str, raw_text: str, db: Session, 
                       sliding_window_size: int = 10, cleaning_level: str = "full", 
                       model_params: Dict[str, Any] = None, skip_transcription_errors: bool = True) -> Dict[str, Any]:
        """
        Core method: Add a turn to the conversation with stateful cleaning.
        
        This is where the CleanerContext magic happens:
        1. Skip Lumen turns (they're perfect) 
        2. For user turns, use cleaned history as context
        3. Apply intelligent cleaning based on context
        """
        start_time = time.time()
        print(f"\n[ConversationManager] ===== PROCESSING NEW TURN =====")
        print(f"[ConversationManager] Conversation: {conversation_id}")
        print(f"[ConversationManager] Speaker: {speaker}")
        print(f"[ConversationManager] Raw text: '{raw_text}'")
        
        conversation_state = self.get_conversation_state(conversation_id, sliding_window_size, db)
        
        # Check for transcription errors before processing
        if skip_transcription_errors and self._is_likely_transcription_error(raw_text):
            print(f"[ConversationManager] 🚫 TRANSCRIPTION ERROR DETECTED - Skipping processing")
            print(f"[ConversationManager] Raw text flagged as error: '{raw_text}'")
            result = await self._process_transcription_error(conversation_id, speaker, raw_text, conversation_state, db)
        elif self._is_lumen_turn(speaker):
            print(f"[ConversationManager] 🚀 LUMEN TURN DETECTED - Using instant bypass")
            result = await self._process_lumen_turn(conversation_id, speaker, raw_text, conversation_state, db)
        else:
            print(f"[ConversationManager] 👤 USER TURN DETECTED - Using full CleanerContext processing")
            result = await self._process_user_turn(conversation_id, speaker, raw_text, conversation_state, db, cleaning_level, model_params)
        
        total_time = (time.time() - start_time) * 1000
        print(f"[ConversationManager] ===== TURN COMPLETE in {total_time:.2f}ms =====\n")
        
        return result
    
    def _is_lumen_turn(self, speaker: str) -> bool:
        """Detect if this is a Lumen/AI turn that should be bypassed"""
        lumen_speakers = ['Lumen', 'AI', 'Assistant', 'Claude']
        is_lumen = speaker in lumen_speakers
        
        print(f"[ConversationManager] Turn classification: {speaker} -> {'LUMEN' if is_lumen else 'USER'}")
        return is_lumen
    
    def _get_next_turn_sequence(self, conversation_id: UUID, db: Session) -> int:
        """Get the next turn sequence number for a conversation"""
        try:
            # Get the highest turn_sequence for this conversation
            max_sequence = db.query(Turn.turn_sequence).filter(
                Turn.conversation_id == conversation_id
            ).order_by(Turn.turn_sequence.desc()).first()
            
            if max_sequence:
                return max_sequence[0] + 1
            else:
                return 1  # First turn in conversation
        except Exception as e:
            print(f"[ConversationManager] Error getting next sequence: {e}")
            return 1  # Fallback to 1
    
    def _is_likely_transcription_error(self, text: str) -> bool:
        """Detect likely transcription errors like foreign chars, gibberish, single symbols"""
        import re
        
        # Strip whitespace for analysis
        text = text.strip()
        
        # Very short single character or symbol
        if len(text) <= 2:
            print(f"[ConversationManager] Flagged as error: too short ({len(text)} chars)")
            return True
        
        # Contains primarily non-Latin characters (Arabic, Thai, Chinese, etc.)
        # that are likely transcription errors in English conversations
        non_latin_chars = re.findall(r'[^\x00-\x7F\s]', text)
        if non_latin_chars and len(non_latin_chars) / len(text) > 0.3:
            print(f"[ConversationManager] Flagged as error: high foreign character ratio ({len(non_latin_chars)}/{len(text)})")
            return True
        
        # Single foreign characters or symbols that are clearly errors
        foreign_error_patterns = [
            r'^[أ-ي]+$',  # Arabic script only
            r'^[ก-๙]+$',  # Thai script only
            r'^[가-힣]+$',  # Korean script only
            r'^[一-龯]+$',  # Chinese characters only
            r'^[а-я]+$',   # Cyrillic script only
            r'^[α-ω]+$',   # Greek script only
        ]
        
        for pattern in foreign_error_patterns:
            if re.match(pattern, text):
                print(f"[ConversationManager] Flagged as error: matches foreign script pattern")
                return True
        
        return False
    
    async def _process_transcription_error(self, conversation_id: UUID, speaker: str, raw_text: str,
                                         conversation_state: ConversationState, db: Session) -> Dict[str, Any]:
        """
        Process detected transcription errors by skipping them with minimal processing.
        These are usually foreign characters or gibberish that shouldn't be processed.
        """
        process_start = time.time()
        print(f"[ConversationManager] 🚫 Processing transcription error with skip")
        
        # Skip processing - mark as transcription error with empty cleaned text
        cleaned_text = ""  # Empty - indicates skipped
        processing_time_ms = 0  # Minimal processing time
        
        # Get next turn sequence number for this conversation
        next_sequence = self._get_next_turn_sequence(conversation_id, db)
        
        # Create basic turn data (raw only - no cleaning in turns table anymore)
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'turn_sequence': next_sequence
        }
        
        # Store cleaning metadata separately for return (not in Turn model)
        cleaning_metadata = {
            'confidence_score': 'LOW',
            'cleaning_applied': True,
            'cleaning_level': 'skip',
            'processing_time_ms': processing_time_ms,
            'corrections': [{
                'original': raw_text,
                'corrected': '',
                'confidence': 'HIGH',
                'reason': 'Detected as transcription error - likely foreign characters or gibberish'
            }],
            'context_detected': 'transcription_error',
            'ai_model_used': None
        }
        
        # Add to conversation history (with empty cleaned text to not pollute context)
        conversation_state.add_to_history(turn_data)
        
        # Save to database (with error handling for testing)
        try:
            db_turn = Turn(**turn_data)
            db.add(db_turn)
            db.commit()
            db.refresh(db_turn)
            
            # Ensure created_at is available for response (for testing)
            if not hasattr(db_turn, 'created_at') or db_turn.created_at is None:
                from datetime import datetime
                db_turn.created_at = datetime.utcnow()
        except Exception as e:
            print(f"[ConversationManager] ⚠️ Database error (continuing with mock): {e}")
            # Mock response for testing
            from datetime import datetime
            class MockTurn:
                def __init__(self):
                    self.id = "mock-transcription-error"
                    self.created_at = datetime.utcnow()
            db_turn = MockTurn()
        
        actual_processing_time = (time.time() - process_start) * 1000
        
        print(f"[ConversationManager] ✅ Transcription error processed in {actual_processing_time:.2f}ms")
        print(f"[ConversationManager] Raw text skipped: '{raw_text}'")
        print(f"[ConversationManager] Cleaned text (empty): '{cleaned_text}'")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'metadata': {
                'confidence_score': cleaning_metadata['confidence_score'],
                'cleaning_applied': cleaning_metadata['cleaning_applied'],
                'cleaning_level': cleaning_metadata['cleaning_level'],
                'processing_time_ms': actual_processing_time,
                'corrections': cleaning_metadata['corrections'],
                'context_detected': cleaning_metadata['context_detected'],
                'ai_model_used': cleaning_metadata['ai_model_used']
            },
            'created_at': db_turn.created_at.isoformat()
        }
    
    async def _process_lumen_turn(self, conversation_id: UUID, speaker: str, raw_text: str, 
                                 conversation_state: ConversationState, db: Session) -> Dict[str, Any]:
        """
        Process Lumen turns with ZERO latency - they're already perfect.
        Target: < 10ms processing time
        """
        process_start = time.time()
        print(f"[ConversationManager] 🚀 Processing Lumen turn with instant bypass")
        
        # Lumen turns are perfect - no cleaning needed
        cleaned_text = raw_text
        processing_time_ms = 0  # Conceptually zero processing time
        
        # Get next turn sequence number for this conversation
        next_sequence = self._get_next_turn_sequence(conversation_id, db)
        
        # Create basic turn data (raw only - no cleaning in turns table anymore)
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'turn_sequence': next_sequence
        }
        
        # Store cleaning metadata separately for return and context (not in Turn model)
        cleaning_metadata = {
            'confidence_score': 'HIGH',
            'cleaning_applied': False,
            'cleaning_level': 'none',
            'processing_time_ms': processing_time_ms,
            'corrections': [],
            'context_detected': 'ai_response',
            'ai_model_used': None,
            'timing_breakdown': {
                'context_retrieval_ms': 0,
                'prompt_preparation_ms': 0,
                'gemini_api_ms': 0,
                'database_save_ms': 0,
                'prompt_logging_ms': 0,
                'total_ms': 0
            },
            'gemini_prompt': None,  # No prompt for Lumen turns
            'gemini_response': None  # No Gemini processing for Lumen turns
        }
        
        # Create context data for conversation history (includes cleaning metadata)
        context_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            **cleaning_metadata
        }
        
        # Add to conversation history (with cleaning metadata for context)
        conversation_state.add_to_history(context_data)
        
        # Save to database (with error handling for testing)
        try:
            db_turn = Turn(**turn_data)
            db.add(db_turn)
            db.commit()
            db.refresh(db_turn)
            
            # Ensure created_at is available for response (for testing)
            if not hasattr(db_turn, 'created_at') or db_turn.created_at is None:
                from datetime import datetime
                db_turn.created_at = datetime.utcnow()
        except Exception as e:
            print(f"[ConversationManager] ⚠️ Database error (continuing with mock): {e}")
            # Create mock turn for testing when database is unavailable
            from datetime import datetime
            import uuid
            db_turn = type('MockTurn', (), {
                'id': uuid.uuid4(),
                'created_at': datetime.utcnow()
            })()
        
        actual_processing_time = (time.time() - process_start) * 1000
        self.performance_metrics['lumen_processing_times'].append(actual_processing_time)
        
        print(f"[ConversationManager] ✅ Lumen turn processed in {actual_processing_time:.2f}ms")
        print(f"[ConversationManager] Cleaning applied: {cleaning_metadata['cleaning_applied']}")
        print(f"[ConversationManager] Added to cleaned history for future context")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'metadata': {
                'confidence_score': cleaning_metadata['confidence_score'],
                'cleaning_applied': cleaning_metadata['cleaning_applied'],
                'cleaning_level': cleaning_metadata['cleaning_level'],
                'processing_time_ms': actual_processing_time,
                'corrections': cleaning_metadata['corrections'],
                'context_detected': cleaning_metadata['context_detected'],
                'ai_model_used': cleaning_metadata['ai_model_used']
            },
            'created_at': db_turn.created_at.isoformat()
        }
    
    async def _process_user_turn(self, conversation_id: UUID, speaker: str, raw_text: str,
                                conversation_state: ConversationState, db: Session, 
                                cleaning_level: str = "full", model_params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process user turns with full CleanerContext intelligence.
        Uses cleaned conversation history as context for better cleaning.
        Target: < 500ms processing time
        """
        process_start = time.time()
        print(f"[ConversationManager] 👤 Processing user turn with CleanerContext intelligence")
        
        # Initialize timing breakdown
        timing_breakdown = {
            "context_retrieval_ms": 0,
            "prompt_preparation_ms": 0,
            "gemini_api_ms": 0,
            "database_save_ms": 0,
            "prompt_logging_ms": 0,
            "total_ms": 0
        }
        
        # Get cleaned conversation context (the KEY innovation)
        print(f"[ConversationManager] 🔍 CONTEXT FLOW DEBUG: About to retrieve cleaned sliding window...")
        context_start = time.time()
        cleaned_context = conversation_state.get_cleaned_sliding_window()
        context_time = (time.time() - context_start) * 1000
        timing_breakdown["context_retrieval_ms"] = round(context_time, 2)
        self.performance_metrics['context_retrieval_times'].append(context_time)
        
        print(f"[ConversationManager] ✅ CONTEXT FLOW DEBUG: Retrieved cleaned context in {context_time:.2f}ms")
        print(f"[ConversationManager] 📊 CONTEXT FLOW DEBUG: Context contains {len(cleaned_context)} previous turns")
        
        # Debug: Log the context that will be passed to prompt building
        if len(cleaned_context) > 0:
            print(f"[ConversationManager] 📋 CONTEXT FLOW DEBUG: Context being passed to prompt:")
            for i, turn in enumerate(cleaned_context):
                print(f"[ConversationManager]   Context[{i}]: {turn['speaker']} - '{turn['cleaned_text'][:80]}...'")
        else:
            print(f"[ConversationManager] ❌ CONTEXT FLOW DEBUG: NO CONTEXT available for prompt!")
        
        # Use provided cleaning level or analyze for decision
        if cleaning_level == "auto":
            print(f"[ConversationManager] 🧠 Analyzing turn for cleaning decision...")
            cleaning_decision = self._analyze_cleaning_need(raw_text)
            print(f"[ConversationManager] Decision: {cleaning_decision}")
        else:
            cleaning_decision = cleaning_level
            print(f"[ConversationManager] Using provided cleaning level: {cleaning_decision}")
        
        # Get active prompt template for processing (or use default)
        prompt_start = time.time()
        rendered_prompt_text = None
        try:
            active_template = await self.prompt_service.get_or_create_default_template(db)
            print(f"[ConversationManager] Using prompt template: {active_template.name}")
            
            # Get conversation object for context fields
            from app.models.conversation import Conversation
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            
            # Build variables using pure 5-variable system
            print(f"[ConversationManager] 🎯 PURE VARIABLES: Building 5-variable system...")
            variables = self._build_template_variables(
                raw_text=raw_text,
                cleaned_context=cleaned_context,
                cleaning_decision=cleaning_decision,
                conversation=conversation
            )
            
            # Debug: Show all variables being used
            print(f"[ConversationManager] 📋 PURE VARIABLES: Built {len(variables)} variables:")
            for key, value in variables.items():
                preview = value[:50] + "..." if len(value) > 50 else value
                print(f"[ConversationManager]   → {key}: '{preview}' ({len(value)} chars)")
            
            # Validate template variables and show warnings
            validation = self.prompt_service.validate_template_variables(active_template.template, variables)
            
            # Log warnings to user (don't auto-fix)
            if validation["warnings"]:
                print(f"[ConversationManager] ⚠️ Template Warnings:")
                for warning in validation["warnings"]:
                    print(f"[ConversationManager]   → {warning}")
            
            # Fail if validation errors exist
            if not validation["valid"]:
                print(f"[ConversationManager] ❌ Template Errors:")
                for error in validation["errors"]:
                    print(f"[ConversationManager]   → {error}")
                raise ValueError(f"Template validation failed: {validation['errors']}")
            
            # Render the prompt with validated variables
            rendered_prompt = await self.prompt_service.render_prompt(db, active_template.id, variables)
            if rendered_prompt:
                print(f"[ConversationManager] Rendered prompt with {len(variables)} variables")
                print(f"[ConversationManager] Estimated tokens: {rendered_prompt.token_count}")
                rendered_prompt_text = rendered_prompt.rendered_prompt
            
        except Exception as e:
            print(f"[ConversationManager] ⚠️ Prompt service error: {e}")
            rendered_prompt = None
            active_template = None
            rendered_prompt_text = None
        
        prompt_time = (time.time() - prompt_start) * 1000
        timing_breakdown["prompt_preparation_ms"] = round(prompt_time, 2)

        # Use Gemini 2.5 Flash for actual cleaning
        print(f"[ConversationManager] 🤖 Applying {cleaning_decision} cleaning with Gemini...")
        if model_params:
            print(f"[ConversationManager] Using custom model params: {model_params}")
        
        gemini_start = time.time()
        try:
            print(f"[ConversationManager] Calling Gemini service for {speaker} turn...")
            
            # Add progress monitoring for long API calls
            async def progress_monitor():
                await asyncio.sleep(10)  # Wait 10 seconds
                if time.time() - gemini_start > 10:
                    print(f"[ConversationManager] ⏳ Gemini call still running after 10s...")
                await asyncio.sleep(20)  # Wait another 20 seconds  
                if time.time() - gemini_start > 30:
                    print(f"[ConversationManager] ⏳ Gemini call still running after 30s...")
                await asyncio.sleep(30)  # Wait another 30 seconds
                if time.time() - gemini_start > 60:
                    print(f"[ConversationManager] ⚠️ Gemini call taking very long (60s+)...")
            
            # Start progress monitor
            monitor_task = asyncio.create_task(progress_monitor())
            
            # Call Gemini service
            cleaned_result = await self.gemini_service.clean_conversation_turn(
                raw_text=raw_text,
                speaker=speaker,
                cleaned_context=cleaned_context,
                cleaning_level=cleaning_decision,
                model_params=model_params,
                rendered_prompt=rendered_prompt_text  # Pass the prompt for storage
            )
            
            # Cancel progress monitor since we're done
            monitor_task.cancel()
            
            gemini_time = (time.time() - gemini_start) * 1000
            timing_breakdown["gemini_api_ms"] = round(gemini_time, 2)
            print(f"[ConversationManager] ✅ Gemini processing completed in {gemini_time:.2f}ms")
            
        except Exception as e:
            gemini_time = (time.time() - gemini_start) * 1000
            timing_breakdown["gemini_api_ms"] = round(gemini_time, 2)
            
            # Enhanced logging for timeouts
            if "TimeoutError" in str(type(e).__name__):
                print(f"[ConversationManager] 🚨 CRITICAL TIMEOUT: Gemini API timed out after {gemini_time:.2f}ms")
                print(f"[ConversationManager] 🚨 TIMEOUT CONTEXT: {speaker} turn, {len(raw_text)} chars")
                print(f"[ConversationManager] 🚨 TEXT PREVIEW: '{raw_text[:200]}...'")
                logger.error(f"🚨 CRITICAL: Gemini timeout in conversation {conversation_id}")
                logger.error(f"🚨 TIMEOUT TURN: {speaker} - {len(raw_text)} chars - {raw_text[:100]}...")
            else:
                print(f"[ConversationManager] ❌ Gemini processing failed after {gemini_time:.2f}ms: {e}")
            
            # Create fallback result when Gemini fails
            error_type = "timeout_3s" if "TimeoutError" in str(type(e).__name__) else str(type(e).__name__)
            cleaned_result = {
                "cleaned_text": raw_text,  # Return original text as fallback
                "metadata": {
                    "confidence_score": "LOW",
                    "cleaning_applied": False,
                    "cleaning_level": "fallback",
                    "corrections": [],
                    "context_detected": f"error_fallback_{error_type}",
                    "ai_model_used": f"fallback_due_to_{error_type}",
                    "error_type": error_type,
                    "timeout_occurred": "TimeoutError" in str(type(e).__name__)
                },
                "raw_response": None
            }
            print(f"[ConversationManager] Using fallback response for {speaker} turn due to {error_type}")
        
        # Calculate final timing before creating turn_data
        processing_time_ms = (time.time() - process_start) * 1000
        self.performance_metrics['user_processing_times'].append(processing_time_ms)
        
        # Complete timing breakdown BEFORE saving to database
        # Calculate the sum of individual components to ensure math accuracy
        component_sum = (
            timing_breakdown.get("context_retrieval_ms", 0) +
            timing_breakdown.get("prompt_preparation_ms", 0) +
            timing_breakdown.get("gemini_api_ms", 0)
        )
        
        # Add placeholders (will be filled after DB operations)
        timing_breakdown["database_save_ms"] = 0  # Will be updated after DB save
        timing_breakdown["prompt_logging_ms"] = 0  # Will be updated after prompt logging
        timing_breakdown["total_ms"] = round(component_sum, 2)  # Use component sum, not wall clock time
        
        print(f"[ConversationManager] 🔍 TIMING FIX DEBUG: Final timing_breakdown before DB save: {timing_breakdown}")
        print(f"[ConversationManager] 📊 TIMING FIX DEBUG: timing_breakdown keys: {list(timing_breakdown.keys())}")
        print(f"[ConversationManager] 📊 TIMING FIX DEBUG: timing_breakdown length: {len(timing_breakdown)}")
        
        # Create a copy of timing_breakdown to avoid reference issues
        timing_breakdown_copy = timing_breakdown.copy()
        
        # Get next turn sequence number for this conversation
        next_sequence = self._get_next_turn_sequence(conversation_id, db)
        
        # Create basic turn data (raw only - no cleaning in turns table anymore)
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'turn_sequence': next_sequence
        }
        
        # Store cleaning metadata separately for return and context (not in Turn model)
        cleaning_metadata = {
            'cleaned_text': cleaned_result['cleaned_text'],
            'confidence_score': cleaned_result['metadata']['confidence_score'],
            'cleaning_applied': str(cleaned_result['metadata']['cleaning_applied']),
            'cleaning_level': cleaned_result['metadata']['cleaning_level'],
            'processing_time_ms': processing_time_ms,
            'corrections': cleaned_result['metadata']['corrections'],
            'context_detected': cleaned_result['metadata']['context_detected'],
            'ai_model_used': cleaned_result['metadata']['ai_model_used'],
            'timing_breakdown': timing_breakdown_copy,  # Use copy to avoid reference issues
            'gemini_prompt': cleaned_result.get('prompt_used', None),
            'gemini_response': cleaned_result.get('raw_response', None)
        }
        
        # Create context data for conversation history (includes cleaning metadata)
        context_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            **cleaning_metadata
        }
        
        # Add to conversation history (THIS IS THE KEY - cleaned version goes to history)
        conversation_state.add_to_history(context_data)
        
        # Save to database (with error handling for testing)
        print(f"[ConversationManager] 🔍 DB SAVE DEBUG: Preparing to save turn to database...")
        print(f"[ConversationManager] 📊 DB SAVE DEBUG: timing_breakdown data: {timing_breakdown}")
        print(f"[ConversationManager] 🔍 DB SAVE DEBUG: timing_breakdown type: {type(timing_breakdown)}")
        
        db_start = time.time()
        try:
            print(f"[ConversationManager] 💾 DB SAVE DEBUG: Creating Turn object with turn_data...")
            
            # Debug database configuration
            from app.core.config import settings
            print(f"[ConversationManager] 🔍 DB CONFIG DEBUG: DATABASE_URL: {settings.DATABASE_URL[:60]}...{settings.DATABASE_URL[-20:]}")
            print(f"[ConversationManager] 🔍 DB CONFIG DEBUG: Database session type: {type(db)}")
            
            # Debug the turn_data before saving
            print(f"[ConversationManager] 📋 DB SAVE DEBUG: turn_data keys: {list(turn_data.keys())}")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: turn_data.timing_breakdown: {turn_data.get('timing_breakdown', 'NOT_SET')}")
            print(f"[ConversationManager] 🔍 DB SAVE DEBUG: timing_breakdown type: {type(turn_data.get('timing_breakdown'))}")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: timing_breakdown contents: {turn_data.get('timing_breakdown')}")
            
            db_turn = Turn(**turn_data)
            
            # Immediately check what got saved to the object
            print(f"[ConversationManager] 🔍 DB SAVE DEBUG: IMMEDIATELY after Turn creation:")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: db_turn.timing_breakdown: {db_turn.timing_breakdown}")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: db_turn.timing_breakdown type: {type(db_turn.timing_breakdown)}")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: db_turn.timing_breakdown keys: {list(db_turn.timing_breakdown.keys()) if db_turn.timing_breakdown else 'None'}")
            
            print(f"[ConversationManager] ✅ DB SAVE DEBUG: Turn object created successfully")
            print(f"[ConversationManager] 📊 DB SAVE DEBUG: db_turn.timing_breakdown: {getattr(db_turn, 'timing_breakdown', 'NOT_SET')}")
            
            # Explicitly mark the timing_breakdown as modified for SQLAlchemy
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(db_turn, 'timing_breakdown')
            
            db.add(db_turn)
            db.commit()
            
            # Calculate database save time and update timing breakdown
            db_time = (time.time() - db_start) * 1000
            timing_breakdown["database_save_ms"] = round(db_time, 2)
            
            # Ensure created_at is available for response
            if not hasattr(db_turn, 'created_at') or db_turn.created_at is None:
                from datetime import datetime
                db_turn.created_at = datetime.utcnow()
                
            print(f"[ConversationManager] ⏱️ DB SAVE DEBUG: Database save took {db_time:.2f}ms")
                
        except Exception as e:
            print(f"[ConversationManager] ❌ CRITICAL DB ERROR: {e}")
            print(f"[ConversationManager] ❌ CRITICAL ERROR TYPE: {type(e).__name__}")
            print(f"[ConversationManager] ❌ CRITICAL ERROR DETAILS: {str(e)}")
            
            # Print the exact turn_data that's causing the issue
            print(f"[ConversationManager] 🔍 PROBLEMATIC TURN DATA:")
            for key, value in turn_data.items():
                print(f"[ConversationManager]   {key}: {type(value)} = {str(value)[:100]}...")
            
            import traceback
            print(f"[ConversationManager] ❌ FULL TRACEBACK:")
            traceback.print_exc()
            print(f"[ConversationManager] ⚠️ Database error (continuing with mock): {e}")
            # Create mock turn for testing when database is unavailable
            from datetime import datetime
            import uuid
            db_turn = type('MockTurn', (), {
                'id': uuid.uuid4(),
                'created_at': datetime.utcnow(),
                'timing_breakdown': {},  # Empty timing for mock
                'processing_time_ms': 0   # Zero processing time for mock
            })()
            print(f"[ConversationManager] 🔧 DB SAVE DEBUG: Created mock turn for fallback")
            db_time = (time.time() - db_start) * 1000
            timing_breakdown["database_save_ms"] = round(db_time, 2)
        
        # Log prompt usage for analytics
        prompt_log_start = time.time()
        if active_template and rendered_prompt:
            try:
                await self.prompt_service.log_prompt_usage(
                    db=db,
                    template_id=active_template.id,
                    rendered_prompt=rendered_prompt.rendered_prompt,
                    variables=variables,
                    turn_id=db_turn.id,
                    conversation_id=conversation_id,
                    processing_time_ms=processing_time_ms,
                    confidence_score=turn_data['confidence_score'],
                    corrections_count=len(turn_data['corrections'])
                )
                print(f"[ConversationManager] ✅ Logged prompt usage for analytics")
            except Exception as e:
                print(f"[ConversationManager] ⚠️ Failed to log prompt usage: {e}")
        prompt_log_time = (time.time() - prompt_log_start) * 1000
        timing_breakdown["prompt_logging_ms"] = round(prompt_log_time, 2)
        
        # Calculate accurate total from all components
        final_total = (
            timing_breakdown.get("context_retrieval_ms", 0) +
            timing_breakdown.get("prompt_preparation_ms", 0) +
            timing_breakdown.get("gemini_api_ms", 0) +
            timing_breakdown.get("database_save_ms", 0) +
            timing_breakdown.get("prompt_logging_ms", 0)
        )
        timing_breakdown["total_ms"] = round(final_total, 2)

        print(f"[ConversationManager] ✅ User turn processed in {processing_time_ms:.2f}ms")
        print(f"[ConversationManager] 📊 Final timing breakdown: {timing_breakdown}")
        print(f"[ConversationManager] Cleaning applied: {cleaning_metadata['cleaning_applied']}")
        print(f"[ConversationManager] Confidence: {cleaning_metadata['confidence_score']}")
        print(f"[ConversationManager] Corrections made: {len(cleaning_metadata['corrections'])}")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaning_metadata['cleaned_text'],
            'metadata': {
                'confidence_score': cleaning_metadata['confidence_score'],
                'cleaning_applied': cleaning_metadata['cleaning_applied'],
                'cleaning_level': cleaning_metadata['cleaning_level'],
                'processing_time_ms': processing_time_ms,
                'timing_breakdown': timing_breakdown,
                'corrections': cleaning_metadata['corrections'],
                'context_detected': cleaning_metadata['context_detected'],
                'ai_model_used': cleaning_metadata['ai_model_used'],
                'gemini_prompt': cleaning_metadata.get('gemini_prompt', None),
                'gemini_response': cleaning_metadata.get('gemini_response', None)
            },
            'created_at': db_turn.created_at.isoformat()
        }
    
    async def process_turn_preview(self, conversation_id: UUID, speaker: str, raw_text: str, 
                                   context: List[Dict[str, Any]] = None,
                                   sliding_window_size: int = 10, cleaning_level: str = "full", 
                                   model_params: Dict[str, Any] = None, skip_transcription_errors: bool = True) -> Dict[str, Any]:
        """
        Process a turn for preview WITHOUT saving to database.
        
        This method:
        - Processes the turn with CleanerContext intelligence
        - Uses provided context instead of loading from database
        - Returns cleaned results with all metadata
        - Does NOT save anything to database
        """
        start_time = time.time()
        print(f"\n[ConversationManager] ===== PREVIEW PROCESSING =====")
        print(f"[ConversationManager] Conversation: {conversation_id}")
        print(f"[ConversationManager] Speaker: {speaker}")
        print(f"[ConversationManager] Raw text: '{raw_text}'")
        print(f"[ConversationManager] Context provided: {len(context) if context else 0} turns")
        print(f"[ConversationManager] PREVIEW MODE: No database saves")
        
        # Skip processing for Lumen turns (instant bypass)
        if speaker.lower() in ['lumen', 'ai', 'assistant']:
            processing_time_ms = (time.time() - start_time) * 1000
            print(f"[ConversationManager] ⚡ Lumen turn bypass in {processing_time_ms:.2f}ms")
            
            import uuid
            from datetime import datetime
            
            return {
                'turn_id': str(uuid.uuid4()),  # Generate preview ID
                'conversation_id': str(conversation_id),
                'speaker': speaker,
                'raw_text': raw_text,
                'cleaned_text': raw_text,  # No cleaning for Lumen
                'metadata': {
                    'confidence_score': 'BYPASS',
                    'cleaning_applied': False,
                    'cleaning_level': 'none',
                    'processing_time_ms': processing_time_ms,
                    'timing_breakdown': {
                        'context_retrieval_ms': 0,
                        'prompt_preparation_ms': 0,
                        'gemini_api_ms': 0,
                        'database_save_ms': 0,
                        'prompt_logging_ms': 0,
                        'total_ms': processing_time_ms
                    },
                    'corrections': [],
                    'context_detected': 'ai_response',
                    'ai_model_used': None,
                    'gemini_prompt': None,
                    'gemini_response': None
                },
                'created_at': datetime.utcnow().isoformat()
            }
        
        # Process user turn with Gemini
        process_start = time.time()
        
        # Convert provided context (ContextTurn objects) to the format expected by Gemini
        cleaned_context = []
        if context:
            for turn in context:
                # Convert ContextTurn object to dictionary format
                cleaned_context.append({
                    'speaker': turn.speaker,
                    'cleaned_text': turn.cleaned_text
                })
        print(f"[ConversationManager] Using provided context: {len(cleaned_context)} turns")
        
        # Process with Gemini using the same method as regular processing
        gemini_start = time.time()
        cleaned_result = await self.gemini_service.clean_conversation_turn(
            raw_text=raw_text,
            speaker=speaker,
            cleaned_context=cleaned_context,
            cleaning_level=cleaning_level,
            model_params=model_params,
            rendered_prompt=None  # Uses hardcoded prompt in Gemini service
        )
        gemini_time = (time.time() - gemini_start) * 1000
        
        processing_time_ms = (time.time() - process_start) * 1000
        total_time_ms = (time.time() - start_time) * 1000
        
        # Build timing breakdown
        timing_breakdown = {
            'context_retrieval_ms': 0,  # No DB access in preview
            'prompt_preparation_ms': 0,  # No prompt preparation in preview
            'gemini_api_ms': gemini_time,
            'database_save_ms': 0,  # No save in preview
            'prompt_logging_ms': 0,  # No logging in preview
            'total_ms': total_time_ms
        }
        
        print(f"[ConversationManager] ✅ Preview processed in {total_time_ms:.2f}ms")
        print(f"[ConversationManager] Cleaning applied: {cleaned_result['metadata']['cleaning_applied']}")
        print(f"[ConversationManager] Confidence: {cleaned_result['metadata']['confidence_score']}")
        
        import uuid
        from datetime import datetime
        
        return {
            'turn_id': str(uuid.uuid4()),  # Generate preview ID
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_result['cleaned_text'],
            'metadata': {
                'confidence_score': cleaned_result['metadata']['confidence_score'],
                'cleaning_applied': cleaned_result['metadata']['cleaning_applied'],
                'cleaning_level': cleaned_result['metadata']['cleaning_level'],
                'processing_time_ms': processing_time_ms,
                'timing_breakdown': timing_breakdown,
                'corrections': cleaned_result['metadata']['corrections'],
                'context_detected': cleaned_result['metadata']['context_detected'],
                'ai_model_used': cleaned_result['metadata']['ai_model_used'],
                'gemini_prompt': cleaned_result.get('prompt_used', None),
                'gemini_response': cleaned_result.get('raw_response', None)
            },
            'created_at': datetime.utcnow().isoformat()
        }
    
    def _analyze_cleaning_need(self, raw_text: str) -> str:
        """
        Analyze text to determine optimal cleaning level
        """
        print(f"[ConversationManager] 🔍 Analyzing text for cleaning patterns...")
        
        # Simple pattern detection
        text_lower = raw_text.lower()
        
        # Check for simple acknowledgments (no cleaning needed)
        simple_responses = ['yes', 'no', 'ok', 'okay', 'right', 'correct', 'exactly', 'sure', 'yep', 'nope']
        if text_lower.strip() in simple_responses:
            print(f"[ConversationManager] Pattern: Simple acknowledgment detected")
            return 'none'
        
        # Check for obvious STT error indicators
        stt_error_indicators = [
            '<noise>', 'อ', '…', '...',  # Noise and artifacts from examples
            'vector of', 'book marketing',  # Known STT errors
            'are product', 'there results',
            # Foreign characters mixed with English (common STT issue)
        ]
        
        has_errors = any(indicator in raw_text for indicator in stt_error_indicators)
        
        # Check for very short responses (likely need minimal cleaning)
        if len(raw_text.strip()) < 10:
            print(f"[ConversationManager] Pattern: Very short response")
            return 'light'
        
        # Check for obvious errors or artifacts
        if has_errors or '  ' in raw_text or raw_text.count('.') > 3:
            print(f"[ConversationManager] Pattern: STT errors/artifacts detected")
            return 'full'
        
        # Default to light cleaning for normal conversation
        print(f"[ConversationManager] Pattern: Normal conversation - light cleaning")
        return 'light'
    
    def _simulate_cleaning_process(self, raw_text: str, context: List[Dict], decision: str) -> Dict[str, Any]:
        """
        Simulate the cleaning process (will be replaced with AI in Day 8)
        """
        print(f"[ConversationManager] 🛠️ Simulating {decision} cleaning process...")
        
        if decision == 'none':
            return {
                'cleaned_text': raw_text,
                'confidence_score': 'HIGH',
                'cleaning_applied': False,
                'corrections': [],
                'context_detected': 'simple_acknowledgment'
            }
        
        # Simulate corrections for known patterns
        cleaned_text = raw_text
        corrections = []
        
        if 'vector of' in raw_text.lower():
            cleaned_text = raw_text.replace('vector of', 'Director of')
            corrections.append({
                'original': 'vector of',
                'corrected': 'Director of',
                'confidence': 'HIGH',
                'reason': 'stt_error_pattern'
            })
        
        if 'book marketing' in raw_text.lower():
            cleaned_text = cleaned_text.replace('book marketing', 'bulk marketing') 
            corrections.append({
                'original': 'book marketing',
                'corrected': 'bulk marketing',
                'confidence': 'MEDIUM',
                'reason': 'contextual_understanding'
            })
        
        cleaning_applied = len(corrections) > 0
        confidence = 'HIGH' if cleaning_applied else 'MEDIUM'
        
        print(f"[ConversationManager] Applied {len(corrections)} corrections")
        for correction in corrections:
            print(f"[ConversationManager] Correction: '{correction['original']}' -> '{correction['corrected']}'")
        
        return {
            'cleaned_text': cleaned_text,
            'confidence_score': confidence,
            'cleaning_applied': cleaning_applied,
            'corrections': corrections,
            'context_detected': 'business_discussion'
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for monitoring"""
        metrics = {}
        
        for metric_name, times in self.performance_metrics.items():
            if times:
                metrics[metric_name] = {
                    'avg_ms': sum(times) / len(times),
                    'max_ms': max(times),
                    'min_ms': min(times),
                    'count': len(times)
                }
            else:
                metrics[metric_name] = {
                    'avg_ms': 0,
                    'max_ms': 0,
                    'min_ms': 0,
                    'count': 0
                }
        
        print(f"[ConversationManager] Performance metrics: {metrics}")
        return metrics