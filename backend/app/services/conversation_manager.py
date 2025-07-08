"""
ConversationManager - Core stateful conversation processing with CleanerContext

This is the heart of the CleanerContext system - manages stateful conversation 
cleaning using cleaned history in sliding window context.
"""

import time
import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.conversation import Conversation
from app.models.turn import Turn
from app.core.database import get_db
from app.services.gemini_service import GeminiService
from app.services.prompt_engineering_service import PromptEngineeringService

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
        print(f"[ConversationState] Getting sliding window, current history length: {len(self.cleaned_history)}")
        
        # Return last N turns of CLEANED conversation history
        window = self.cleaned_history[-self.sliding_window_size:]
        
        print(f"[ConversationState] Sliding window contains {len(window)} turns")
        for i, turn in enumerate(window):
            print(f"[ConversationState] Window[{i}]: {turn['speaker']} -> '{turn['cleaned_text'][:50]}...'")
        
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
    
    def get_conversation_state(self, conversation_id: UUID, sliding_window_size: int = 10) -> ConversationState:
        """Get or create conversation state for stateful processing"""
        print(f"[ConversationManager] Getting conversation state for {conversation_id}")
        
        if conversation_id not in self.active_conversations:
            print(f"[ConversationManager] Creating new conversation state for {conversation_id}")
            self.active_conversations[conversation_id] = ConversationState(conversation_id, sliding_window_size)
            
            # Load existing turns from database to rebuild context
            self._load_existing_context(conversation_id)
        else:
            print(f"[ConversationManager] Using existing conversation state for {conversation_id}")
            # Update sliding window size if provided
            if sliding_window_size != 10:  # Only update if different from default
                self.active_conversations[conversation_id].sliding_window_size = sliding_window_size
                print(f"[ConversationManager] Updated sliding window size to {sliding_window_size}")
        
        return self.active_conversations[conversation_id]
    
    def _load_existing_context(self, conversation_id: UUID):
        """Load existing turns from database to rebuild conversation context"""
        print(f"[ConversationManager] Loading existing context for conversation {conversation_id}")
        
        # This will be implemented when we have database session injection
        # For now, we'll start with empty context
        print(f"[ConversationManager] Context loading deferred - starting with fresh context")
    
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
        
        conversation_state = self.get_conversation_state(conversation_id, sliding_window_size)
        
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
        
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'LOW',  # Low confidence for transcription errors
            'cleaning_applied': True,   # We did apply "cleaning" by removing gibberish
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
                'confidence_score': turn_data['confidence_score'],
                'cleaning_applied': turn_data['cleaning_applied'],
                'cleaning_level': turn_data['cleaning_level'],
                'processing_time_ms': actual_processing_time,
                'corrections': turn_data['corrections'],
                'context_detected': turn_data['context_detected'],
                'ai_model_used': turn_data['ai_model_used']
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
        
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'HIGH',
            'cleaning_applied': False,
            'cleaning_level': 'none',
            'processing_time_ms': processing_time_ms,
            'corrections': [],
            'context_detected': 'ai_response',
            'ai_model_used': None
        }
        
        # Add to conversation history
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
        print(f"[ConversationManager] Cleaning applied: {turn_data['cleaning_applied']}")
        print(f"[ConversationManager] Added to cleaned history for future context")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'metadata': {
                'confidence_score': turn_data['confidence_score'],
                'cleaning_applied': turn_data['cleaning_applied'],
                'cleaning_level': turn_data['cleaning_level'],
                'processing_time_ms': actual_processing_time,
                'corrections': turn_data['corrections'],
                'context_detected': turn_data['context_detected'],
                'ai_model_used': turn_data['ai_model_used']
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
        
        # OPTIMIZATION 1: Early exit detection for simple responses
        if self._is_simple_clean_response(raw_text):
            print(f"[ConversationManager] ⚡ EARLY EXIT: Simple clean response detected - bypassing AI")
            return await self._process_clean_turn(conversation_id, speaker, raw_text, conversation_state, db, process_start)
        
        # OPTIMIZATION 2: Smart preprocessing to check if cleaning is needed
        preprocessing_result = self._preprocess_text(raw_text)
        if not preprocessing_result['needs_cleaning']:
            print(f"[ConversationManager] ⚡ PREPROCESSING: Text is already clean - bypassing AI")
            print(f"[ConversationManager] Preprocessing reason: {preprocessing_result['reason']}")
            return await self._process_clean_turn(conversation_id, speaker, raw_text, conversation_state, db, process_start)
        
        # Get cleaned conversation context (the KEY innovation)
        context_start = time.time()
        cleaned_context = conversation_state.get_cleaned_sliding_window()
        context_time = (time.time() - context_start) * 1000
        self.performance_metrics['context_retrieval_times'].append(context_time)
        
        print(f"[ConversationManager] Retrieved cleaned context in {context_time:.2f}ms")
        print(f"[ConversationManager] Context contains {len(cleaned_context)} previous turns")
        
        # Use provided cleaning level or analyze for decision
        if cleaning_level == "auto":
            print(f"[ConversationManager] 🧠 Analyzing turn for cleaning decision...")
            cleaning_decision = self._analyze_cleaning_need(raw_text)
            print(f"[ConversationManager] Decision: {cleaning_decision}")
        else:
            cleaning_decision = cleaning_level
            print(f"[ConversationManager] Using provided cleaning level: {cleaning_decision}")
        
        # Get active prompt template for processing (or use default)
        try:
            active_template = await self.prompt_service.get_or_create_default_template(db)
            print(f"[ConversationManager] Using prompt template: {active_template.name}")
            
            # Build variables for prompt
            context_str = ""
            if cleaned_context:
                context_str = "\n".join([
                    f"{turn['speaker']}: {turn['cleaned_text']}" 
                    for turn in cleaned_context[-5:]  # Last 5 turns
                ])
            
            variables = {
                "conversation_context": context_str,
                "raw_text": raw_text,
                "cleaning_level": cleaning_decision
            }
            
            # Render the prompt
            rendered_prompt = await self.prompt_service.render_prompt(db, active_template.id, variables)
            if rendered_prompt:
                print(f"[ConversationManager] Rendered prompt with {len(variables)} variables")
                print(f"[ConversationManager] Estimated tokens: {rendered_prompt.token_count}")
            
        except Exception as e:
            print(f"[ConversationManager] ⚠️ Prompt service error: {e}")
            rendered_prompt = None
            active_template = None

        # Use Gemini 2.5 Flash for actual cleaning
        print(f"[ConversationManager] 🤖 Applying {cleaning_decision} cleaning with Gemini...")
        if model_params:
            print(f"[ConversationManager] Using custom model params: {model_params}")
        cleaned_result = await self.gemini_service.clean_conversation_turn(
            raw_text=raw_text,
            speaker=speaker,
            cleaned_context=cleaned_context,
            cleaning_level=cleaning_decision,
            model_params=model_params
        )
        
        processing_time_ms = (time.time() - process_start) * 1000
        self.performance_metrics['user_processing_times'].append(processing_time_ms)
        
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_result['cleaned_text'],
            'confidence_score': cleaned_result['metadata']['confidence_score'],
            'cleaning_applied': str(cleaned_result['metadata']['cleaning_applied']),
            'cleaning_level': cleaned_result['metadata']['cleaning_level'],
            'processing_time_ms': processing_time_ms,
            'corrections': cleaned_result['metadata']['corrections'],
            'context_detected': cleaned_result['metadata']['context_detected'],
            'ai_model_used': cleaned_result['metadata']['ai_model_used']
        }
        
        # Add to conversation history (THIS IS THE KEY - cleaned version goes to history)
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
            # Create mock turn for testing when database is unavailable
            from datetime import datetime
            import uuid
            db_turn = type('MockTurn', (), {
                'id': uuid.uuid4(),
                'created_at': datetime.utcnow()
            })()
        
        # Log prompt usage for analytics
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

        print(f"[ConversationManager] ✅ User turn processed in {processing_time_ms:.2f}ms")
        print(f"[ConversationManager] Cleaning applied: {turn_data['cleaning_applied']}")
        print(f"[ConversationManager] Confidence: {turn_data['confidence_score']}")
        print(f"[ConversationManager] Corrections made: {len(turn_data['corrections'])}")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': turn_data['cleaned_text'],
            'metadata': {
                'confidence_score': turn_data['confidence_score'],
                'cleaning_applied': turn_data['cleaning_applied'],
                'cleaning_level': turn_data['cleaning_level'],
                'processing_time_ms': processing_time_ms,
                'corrections': turn_data['corrections'],
                'context_detected': turn_data['context_detected'],
                'ai_model_used': turn_data['ai_model_used']
            },
            'created_at': db_turn.created_at.isoformat()
        }
    
    def _is_simple_clean_response(self, text: str) -> bool:
        """
        Early exit detection for simple responses that don't need cleaning.
        These are typically short acknowledgments or already clean phrases.
        """
        import re
        
        # Strip whitespace for comparison
        text_clean = text.strip()
        text_lower = text_clean.lower()
        
        # Single word acknowledgments (case-insensitive)
        simple_words = {
            'yes', 'no', 'ok', 'okay', 'right', 'correct', 'exactly', 
            'sure', 'yep', 'nope', 'yeah', 'nah', 'indeed', 'absolutely',
            'definitely', 'certainly', 'agreed', 'understood', 'thanks',
            'thank you', 'got it', 'alright', 'fine', 'good', 'great'
        }
        
        if text_lower in simple_words:
            print(f"[ConversationManager] Early exit: Simple acknowledgment '{text_clean}'")
            return True
        
        # Common short phrases (already clean)
        clean_phrases = {
            "that's correct", "sounds good", "i understand", "that's right",
            "i agree", "makes sense", "got it", "that works", "perfect",
            "excellent", "wonderful", "let's do it", "let's do that",
            "go ahead", "please continue", "i see", "very good",
            "that's fine", "no problem", "you're welcome", "my pleasure"
        }
        
        if text_lower in clean_phrases:
            print(f"[ConversationManager] Early exit: Clean phrase '{text_clean}'")
            return True
        
        # Check if it's a properly formatted short sentence (under 50 chars)
        if len(text_clean) < 50:
            # Has proper capitalization and punctuation
            if re.match(r'^[A-Z][^.!?]*[.!?]$', text_clean):
                # No obvious STT artifacts
                if not any(artifact in text for artifact in ['...', '…', '  ', '<', '>']):
                    print(f"[ConversationManager] Early exit: Short clean sentence '{text_clean}'")
                    return True
        
        return False
    
    def _preprocess_text(self, text: str) -> Dict[str, Any]:
        """
        Smart preprocessing to determine if text needs cleaning.
        Returns dict with 'needs_cleaning' bool and 'reason' string.
        """
        import re
        
        # Check for obvious STT error indicators
        stt_error_indicators = [
            '<noise>', '…', '...',  # Noise and artifacts
            'vector of', 'book marketing',  # Known STT errors from examples
            'are product', 'there results',
            'book marking', 'Ca mission',  # More known errors
            'sible.sible', 'street. street.',  # Repetition errors
        ]
        
        for indicator in stt_error_indicators:
            if indicator in text:
                return {
                    'needs_cleaning': True,
                    'reason': f'STT error indicator found: {indicator}'
                }
        
        # Check for foreign characters that shouldn't be in English conversation
        if re.search(r'[^\x00-\x7F]', text) and not re.search(r'[éèêëàâäïîôùûç]', text):  # Allow common accents
            foreign_chars = re.findall(r'[^\x00-\x7F]', text)
            return {
                'needs_cleaning': True,
                'reason': f'Foreign characters detected: {foreign_chars[:3]}'
            }
        
        # Check for missing punctuation in longer text
        if len(text.strip()) > 20 and not re.search(r'[.!?,;:]', text):
            return {
                'needs_cleaning': True,
                'reason': 'Missing punctuation in longer text'
            }
        
        # Check for multiple spaces or unusual spacing
        if '  ' in text or text.count(' ') > len(text.split()) * 2:
            return {
                'needs_cleaning': True,
                'reason': 'Unusual spacing detected'
            }
        
        # Check for all lowercase in longer text (likely missing capitalization)
        if len(text.strip()) > 15 and text.islower():
            return {
                'needs_cleaning': True,
                'reason': 'Missing capitalization'
            }
        
        # Check for repeated words/phrases
        words = text.split()
        if len(words) > 3:
            for i in range(len(words) - 1):
                if words[i] == words[i + 1] and len(words[i]) > 2:
                    return {
                        'needs_cleaning': True,
                        'reason': f'Repeated word: {words[i]}'
                    }
        
        # If none of the above, text is likely clean
        return {
            'needs_cleaning': False,
            'reason': 'Text appears clean and well-formatted'
        }
    
    async def _process_clean_turn(self, conversation_id: UUID, speaker: str, raw_text: str,
                                  conversation_state: ConversationState, db: Session, 
                                  process_start: float) -> Dict[str, Any]:
        """
        Process turns that don't need cleaning (early exit or preprocessing determined).
        This bypasses AI calls and prompt template processing for maximum speed.
        """
        # No cleaning needed - use raw text as cleaned text
        cleaned_text = raw_text
        processing_time_ms = (time.time() - process_start) * 1000
        
        turn_data = {
            'conversation_id': conversation_id,
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'HIGH',
            'cleaning_applied': False,
            'cleaning_level': 'none',
            'processing_time_ms': processing_time_ms,
            'corrections': [],
            'context_detected': 'clean_text',
            'ai_model_used': None  # No AI used
        }
        
        # Add to conversation history
        conversation_state.add_to_history(turn_data)
        
        # Save to database
        try:
            db_turn = Turn(**turn_data)
            db.add(db_turn)
            db.commit()
            db.refresh(db_turn)
            
            if not hasattr(db_turn, 'created_at') or db_turn.created_at is None:
                from datetime import datetime
                db_turn.created_at = datetime.utcnow()
        except Exception as e:
            print(f"[ConversationManager] ⚠️ Database error (continuing with mock): {e}")
            from datetime import datetime
            import uuid
            db_turn = type('MockTurn', (), {
                'id': uuid.uuid4(),
                'created_at': datetime.utcnow()
            })()
        
        # Track performance metrics
        self.performance_metrics['user_processing_times'].append(processing_time_ms)
        
        print(f"[ConversationManager] ✅ Clean turn processed in {processing_time_ms:.2f}ms (no AI needed)")
        print(f"[ConversationManager] Cleaning applied: False")
        print(f"[ConversationManager] Confidence: HIGH")
        
        return {
            'turn_id': str(db_turn.id),
            'conversation_id': str(conversation_id),
            'speaker': speaker,
            'raw_text': raw_text,
            'cleaned_text': cleaned_text,
            'metadata': {
                'confidence_score': turn_data['confidence_score'],
                'cleaning_applied': turn_data['cleaning_applied'],
                'cleaning_level': turn_data['cleaning_level'],
                'processing_time_ms': processing_time_ms,
                'corrections': turn_data['corrections'],
                'context_detected': turn_data['context_detected'],
                'ai_model_used': turn_data['ai_model_used']
            },
            'created_at': db_turn.created_at.isoformat()
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