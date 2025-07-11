"""
EvaluationManager - Core evaluation-based conversation processing

This manages the evaluation system where multiple evaluations can be run
on the same conversation with different prompts, settings, and approaches.
"""

import time
import logging
import asyncio
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.evaluation import Evaluation
from app.models.cleaned_turn import CleanedTurn
from app.models.conversation import Conversation
from app.models.turn import Turn
from app.services.gemini_service import GeminiService
from app.services.prompt_engineering_service import PromptEngineeringService

logger = logging.getLogger(__name__)


class EvaluationState:
    """Manages the stateful context for a single evaluation"""
    
    def __init__(self, evaluation_id: UUID, sliding_window_size: int = 10):
        self.evaluation_id = evaluation_id
        self.sliding_window_size = sliding_window_size
        self.cleaned_history: List[Dict[str, Any]] = []
        
        print(f"[EvaluationState] Initialized for evaluation {evaluation_id}")
        print(f"[EvaluationState] Sliding window size: {self.sliding_window_size}")
    
    def get_cleaned_sliding_window(self) -> List[Dict[str, Any]]:
        """Get the cleaned conversation history for context (from THIS evaluation)"""
        print(f"[EvaluationState] 🔍 EVALUATION SLIDING WINDOW: Getting sliding window")
        print(f"[EvaluationState] 📊 Current history length: {len(self.cleaned_history)}")
        print(f"[EvaluationState] 🎯 Window size configured: {self.sliding_window_size}")
        
        # Return last N turns of CLEANED conversation history from this evaluation
        window = self.cleaned_history[-self.sliding_window_size:]
        
        print(f"[EvaluationState] ✂️ Sliding window contains {len(window)} turns")
        
        if len(window) > 0:
            print(f"[EvaluationState] 📋 Window contents:")
            for i, turn in enumerate(window):
                actual_turn_num = len(self.cleaned_history) - len(window) + i + 1
                print(f"[EvaluationState]   Window[{i}] (Turn {actual_turn_num}): {turn['speaker']} -> '{turn['cleaned_text'][:80]}...'")
        else:
            print(f"[EvaluationState] ❌ Window is empty!")
        
        return window
    
    def add_to_history(self, turn_data: Dict[str, Any]):
        """Add a processed cleaned turn to the evaluation history"""
        print(f"[EvaluationState] Adding cleaned turn to evaluation history: {turn_data['speaker']}")
        print(f"[EvaluationState] Raw text: '{turn_data['raw_text'][:100]}...'")
        print(f"[EvaluationState] Cleaned text: '{turn_data['cleaned_text'][:100]}...'")
        
        self.cleaned_history.append(turn_data)
        
        print(f"[EvaluationState] Evaluation history now contains {len(self.cleaned_history)} cleaned turns")


class EvaluationManager:
    """
    Core evaluation management with CleanerContext processing.
    
    Key Innovation: Each evaluation has its own cleaned history and context window.
    Multiple evaluations of the same conversation can use different cleaning approaches.
    """
    
    def __init__(self):
        self.active_evaluations: Dict[UUID, EvaluationState] = {}
        self.gemini_service = GeminiService()
        self.prompt_service = PromptEngineeringService()
        self.performance_metrics = {
            'lumen_processing_times': [],
            'user_processing_times': [],
            'transcription_error_processing_times': [],
            'context_retrieval_times': [],
            'gemini_api_times': [],
            'total_turns_processed': 0,
            'total_lumen_turns': 0,
            'total_user_turns': 0,
            'total_transcription_errors': 0,
            'average_context_size': [],
            'sliding_window_sizes': []
        }
        
        print("[EvaluationManager] Initialized with evaluation-based processing")
        print("[EvaluationManager] Performance metrics tracking enabled")
        print("[EvaluationManager] Prompt Engineering Service integrated")
    
    async def create_evaluation(self, conversation_id: UUID, name: str, user_id: UUID, 
                              description: str = None, prompt_template: str = None, 
                              settings: Dict[str, Any] = None, db: Session = None) -> Evaluation:
        """Create a new evaluation for a conversation"""
        print(f"[EvaluationManager] Creating new evaluation: '{name}' for conversation {conversation_id}")
        
        # Verify conversation exists
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Create evaluation record
        evaluation = Evaluation(
            conversation_id=conversation_id,
            name=name,
            description=description,
            prompt_template=prompt_template,
            settings=settings or {},
            user_id=user_id,
            status="active"
        )
        
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        
        print(f"[EvaluationManager] ✅ Created evaluation {evaluation.id}")
        return evaluation
    
    def get_evaluation_state(self, evaluation_id: UUID, sliding_window_size: int = 10, 
                           db: Session = None) -> EvaluationState:
        """Get or create evaluation state for stateful processing"""
        print(f"[EvaluationManager] Getting evaluation state for {evaluation_id}")
        
        if evaluation_id not in self.active_evaluations:
            print(f"[EvaluationManager] Creating new evaluation state for {evaluation_id}")
            self.active_evaluations[evaluation_id] = EvaluationState(evaluation_id, sliding_window_size)
            
            # Load existing cleaned turns from database to rebuild context
            self._load_existing_evaluation_context(evaluation_id, db)
        else:
            print(f"[EvaluationManager] Using existing evaluation state for {evaluation_id}")
            # Update sliding window size if provided
            if sliding_window_size != 10:
                self.active_evaluations[evaluation_id].sliding_window_size = sliding_window_size
                print(f"[EvaluationManager] Updated sliding window size to {sliding_window_size}")
        
        return self.active_evaluations[evaluation_id]
    
    def _load_existing_evaluation_context(self, evaluation_id: UUID, db: Session = None):
        """Load existing cleaned turns from database to rebuild evaluation context"""
        print(f"[EvaluationManager] 🔍 CONTEXT DEBUG: Loading existing context for evaluation {evaluation_id}")
        
        if not db:
            print(f"[EvaluationManager] ❌ CONTEXT DEBUG: No database session available")
            return
        
        try:
            # Query existing cleaned turns for this evaluation, ordered by turn sequence
            existing_cleaned_turns = db.query(CleanedTurn).join(Turn).filter(
                CleanedTurn.evaluation_id == evaluation_id
            ).order_by(Turn.turn_sequence.asc()).all()
            
            print(f"[EvaluationManager] 📊 CONTEXT DEBUG: Found {len(existing_cleaned_turns)} existing cleaned turns")
            
            if not existing_cleaned_turns:
                print(f"[EvaluationManager] ❌ CONTEXT DEBUG: No existing cleaned turns found")
                return
            
            # Get the evaluation state
            evaluation_state = self.active_evaluations.get(evaluation_id)
            if not evaluation_state:
                print(f"[EvaluationManager] ❌ CONTEXT DEBUG: No evaluation state found for {evaluation_id}")
                return
            
            print(f"[EvaluationManager] 🔍 CONTEXT DEBUG: Loading {len(existing_cleaned_turns)} cleaned turns into context...")
            
            # Convert cleaned turns to evaluation state format
            for i, cleaned_turn in enumerate(existing_cleaned_turns):
                turn_data = {
                    'evaluation_id': evaluation_id,
                    'speaker': cleaned_turn.turn.speaker,  # From the raw turn
                    'raw_text': cleaned_turn.turn.raw_text,  # From the raw turn
                    'cleaned_text': cleaned_turn.cleaned_text,  # From the cleaned turn
                    'confidence_score': cleaned_turn.confidence_score,
                    'cleaning_applied': cleaned_turn.cleaning_applied,
                    'cleaning_level': cleaned_turn.cleaning_level,
                    'processing_time_ms': cleaned_turn.processing_time_ms,
                    'corrections': cleaned_turn.corrections or [],
                    'context_detected': cleaned_turn.context_detected,
                    'ai_model_used': cleaned_turn.ai_model_used
                }
                
                # Add to evaluation state history
                evaluation_state.cleaned_history.append(turn_data)
                
                print(f"[EvaluationManager] 📝 CONTEXT DEBUG: Loaded CleanedTurn {i+1}: {cleaned_turn.turn.speaker}")
                print(f"[EvaluationManager]   ↳ Raw: '{cleaned_turn.turn.raw_text[:60]}...'")
                print(f"[EvaluationManager]   ↳ Cleaned: '{cleaned_turn.cleaned_text[:60]}...'")
            
            print(f"[EvaluationManager] ✅ CONTEXT DEBUG: Successfully loaded {len(existing_cleaned_turns)} cleaned turns")
            print(f"[EvaluationManager] 📈 CONTEXT DEBUG: Total evaluation history length: {len(evaluation_state.cleaned_history)}")
                    
        except Exception as e:
            print(f"[EvaluationManager] ❌ CONTEXT DEBUG: Failed to load existing context: {e}")
            print(f"[EvaluationManager] ❌ CONTEXT DEBUG: Continuing with fresh context")
            import traceback
            traceback.print_exc()
    
    async def process_turn(self, evaluation_id: UUID, turn_id: UUID, db: Session,
                          override_settings: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a raw turn through this evaluation's cleaning approach.
        
        This creates a cleaned turn linked to both the evaluation and the raw turn.
        """
        start_time = time.time()
        
        # Get evaluation and turn data
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not evaluation:
            raise ValueError(f"Evaluation {evaluation_id} not found")
        
        raw_turn = db.query(Turn).filter(Turn.id == turn_id).first()
        if not raw_turn:
            raise ValueError(f"Turn {turn_id} not found")
        
        print(f"\n[EvaluationManager] ===== PROCESSING TURN IN EVALUATION =====")
        print(f"[EvaluationManager] Evaluation: {evaluation.name} ({evaluation_id})")
        print(f"[EvaluationManager] Turn: {raw_turn.speaker} - '{raw_turn.raw_text[:100]}...'")
        
        # Get evaluation settings
        settings = evaluation.settings.copy() if evaluation.settings else {}
        if override_settings:
            settings.update(override_settings)
        
        sliding_window_size = settings.get('sliding_window', 10)
        cleaning_level = settings.get('cleaning_level', 'full')
        model_params = settings.get('model_params')
        
        # Get evaluation state with cleaned context
        evaluation_state = self.get_evaluation_state(evaluation_id, sliding_window_size, db)
        cleaned_context = evaluation_state.get_cleaned_sliding_window()
        
        # Skip processing for Lumen turns (instant bypass)
        if self._is_lumen_turn(raw_turn.speaker):
            print(f"[EvaluationManager] 🚀 LUMEN TURN DETECTED - Using instant bypass")
            result = await self._process_lumen_turn(evaluation, raw_turn, evaluation_state, db)
        elif self._is_likely_transcription_error(raw_turn.raw_text):
            print(f"[EvaluationManager] 🚫 TRANSCRIPTION ERROR DETECTED - Skipping processing")
            result = await self._process_transcription_error(evaluation, raw_turn, evaluation_state, db)
        else:
            print(f"[EvaluationManager] 👤 USER TURN DETECTED - Using full CleanerContext processing")
            result = await self._process_user_turn(evaluation, raw_turn, evaluation_state, db, 
                                                 cleaned_context, cleaning_level, model_params)
        
        total_time = (time.time() - start_time) * 1000
        
        # Track performance metrics
        self.performance_metrics['total_turns_processed'] += 1
        context_size = len(cleaned_context)
        self.performance_metrics['average_context_size'].append(context_size)
        self.performance_metrics['sliding_window_sizes'].append(sliding_window_size)
        
        print(f"[EvaluationManager] ===== TURN COMPLETE in {total_time:.2f}ms =====\n")
        print(f"[EvaluationManager] Performance: Total processed: {self.performance_metrics['total_turns_processed']}")
        print(f"[EvaluationManager] Performance: Context size: {context_size} turns")
        
        return result
    
    def _is_lumen_turn(self, speaker: str) -> bool:
        """Detect if this is a Lumen/AI turn that should be bypassed"""
        lumen_speakers = ['Lumen', 'AI', 'Assistant', 'Claude']
        is_lumen = speaker in lumen_speakers
        
        print(f"[EvaluationManager] Turn classification: {speaker} -> {'LUMEN' if is_lumen else 'USER'}")
        return is_lumen
    
    def _is_likely_transcription_error(self, text: str) -> bool:
        """Detect if text is likely a transcription error (garbled/foreign text)"""
        # Copy exact logic from ConversationManager
        
        # Check for excessive non-ASCII characters (foreign text)
        non_ascii_chars = sum(1 for char in text if ord(char) > 127)
        non_ascii_ratio = non_ascii_chars / len(text) if len(text) > 0 else 0
        
        # Check for excessive repetition
        words = text.split()
        if len(words) > 0:
            word_counts = {}
            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1
            
            # If any word appears more than 50% of the time, it's likely an error
            max_word_frequency = max(word_counts.values()) / len(words)
            if max_word_frequency > 0.5:
                return True
        
        # Check for very short gibberish
        if len(text.strip()) < 3:
            return True
        
        # Check for high ratio of non-ASCII characters
        if non_ascii_ratio > 0.7:
            return True
        
        # Check for specific transcription error patterns
        error_patterns = [
            'uh uh uh uh',
            'mm mm mm',
            'ah ah ah',
            '....',
            '????'
        ]
        
        text_lower = text.lower()
        for pattern in error_patterns:
            if pattern in text_lower:
                return True
        
        return False
    
    async def _process_transcription_error(self, evaluation: Evaluation, raw_turn: Turn,
                                         evaluation_state: EvaluationState, db: Session) -> Dict[str, Any]:
        """Handle transcription errors by creating cleaned turn with skip metadata"""
        process_start = time.time()
        print(f"[EvaluationManager] 🚫 Processing transcription error with skip")
        
        # Skip cleaning - create cleaned turn with empty text and error metadata
        cleaned_text = ""  # Empty indicates skipped
        processing_time_ms = 0
        
        # Create cleaned turn record with error metadata
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_text,
            confidence_score='LOW',
            cleaning_applied='true',  # We did apply "cleaning" by removing gibberish
            cleaning_level='skip',
            processing_time_ms=processing_time_ms,
            corrections=[{
                'original': raw_turn.raw_text,
                'corrected': '',
                'confidence': 'HIGH',
                'reason': 'Detected as transcription error - likely foreign characters or gibberish'
            }],
            context_detected='transcription_error',
            ai_model_used=None,
            timing_breakdown={
                'context_retrieval_ms': 0,
                'prompt_preparation_ms': 0,
                'gemini_api_ms': 0,
                'database_save_ms': 0,
                'total_ms': 0
            },
            gemini_prompt=None,
            gemini_response=None
        )
        
        # Save to database
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        # Add to evaluation history (with empty cleaned text to not pollute context)
        context_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'LOW',
            'cleaning_applied': True,
            'cleaning_level': 'skip',
            'processing_time_ms': processing_time_ms,
            'corrections': cleaned_turn.corrections,
            'context_detected': 'transcription_error',
            'ai_model_used': None
        }
        evaluation_state.add_to_history(context_data)
        
        actual_processing_time = (time.time() - process_start) * 1000
        self.performance_metrics['transcription_error_processing_times'].append(actual_processing_time)
        self.performance_metrics['total_transcription_errors'] += 1
        
        print(f"[EvaluationManager] ✅ Transcription error processed in {actual_processing_time:.2f}ms")
        print(f"[EvaluationManager] Raw text skipped: '{raw_turn.raw_text}'")
        print(f"[EvaluationManager] Cleaned text (empty): '{cleaned_text}'")
        
        return {
            'cleaned_turn_id': str(cleaned_turn.id),
            'evaluation_id': str(evaluation.id),
            'turn_id': str(raw_turn.id),
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'turn_sequence': raw_turn.turn_sequence,
            'metadata': {
                'confidence_score': 'LOW',
                'cleaning_applied': True,
                'cleaning_level': 'skip',
                'processing_time_ms': actual_processing_time,
                'corrections': cleaned_turn.corrections,
                'context_detected': 'transcription_error',
                'ai_model_used': None
            },
            'created_at': cleaned_turn.created_at.isoformat()
        }
    
    async def _process_lumen_turn(self, evaluation: Evaluation, raw_turn: Turn, 
                                evaluation_state: EvaluationState, db: Session) -> Dict[str, Any]:
        """Process Lumen turns with instant bypass"""
        process_start = time.time()
        print(f"[EvaluationManager] 🚀 Processing Lumen turn with instant bypass")
        
        # Lumen turns are perfect - no cleaning needed
        cleaned_text = raw_turn.raw_text
        processing_time_ms = 0
        
        # Create cleaned turn record
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_text,
            confidence_score='HIGH',
            cleaning_applied='false',
            cleaning_level='none',
            processing_time_ms=processing_time_ms,
            corrections=[],
            context_detected='ai_response',
            ai_model_used=None,
            timing_breakdown={
                'context_retrieval_ms': 0,
                'prompt_preparation_ms': 0,
                'gemini_api_ms': 0,
                'database_save_ms': 0,
                'total_ms': 0
            },
            gemini_prompt=None,
            gemini_response=None
        )
        
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        # Add to evaluation history
        turn_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'HIGH',
            'cleaning_applied': 'false',
            'cleaning_level': 'none',
            'processing_time_ms': processing_time_ms,
            'corrections': [],
            'context_detected': 'ai_response',
            'ai_model_used': None
        }
        
        evaluation_state.add_to_history(turn_data)
        
        # Update evaluation turns count
        evaluation.turns_processed += 1
        db.commit()
        
        actual_processing_time = (time.time() - process_start) * 1000
        self.performance_metrics['lumen_processing_times'].append(actual_processing_time)
        self.performance_metrics['total_lumen_turns'] += 1
        
        print(f"[EvaluationManager] ✅ Lumen turn processed in {actual_processing_time:.2f}ms")
        
        return {
            'cleaned_turn_id': str(cleaned_turn.id),
            'evaluation_id': str(evaluation.id),
            'turn_id': str(raw_turn.id),
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'turn_sequence': raw_turn.turn_sequence,
            'metadata': {
                'confidence_score': 'HIGH',
                'cleaning_applied': False,
                'cleaning_level': 'none',
                'processing_time_ms': actual_processing_time,
                'corrections': [],
                'context_detected': 'ai_response',
                'ai_model_used': None
            },
            'created_at': cleaned_turn.created_at.isoformat()
        }
    
    async def _process_user_turn(self, evaluation: Evaluation, raw_turn: Turn,
                               evaluation_state: EvaluationState, db: Session,
                               cleaned_context: List[Dict[str, Any]], cleaning_level: str,
                               model_params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process user turns with full CleanerContext intelligence"""
        process_start = time.time()
        print(f"[EvaluationManager] 👤 Processing user turn with CleanerContext intelligence")
        
        # Use Gemini service for cleaning
        gemini_start = time.time()
        cleaned_result = await self.gemini_service.clean_conversation_turn(
            raw_text=raw_turn.raw_text,
            speaker=raw_turn.speaker,
            cleaned_context=cleaned_context,
            cleaning_level=cleaning_level,
            model_params=model_params,
            rendered_prompt=evaluation.prompt_template  # Use evaluation's prompt
        )
        gemini_time = (time.time() - gemini_start) * 1000
        
        processing_time_ms = (time.time() - process_start) * 1000
        
        # Create cleaned turn record
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_result['cleaned_text'],
            confidence_score=cleaned_result['metadata']['confidence_score'],
            cleaning_applied=str(cleaned_result['metadata']['cleaning_applied']),
            cleaning_level=cleaned_result['metadata']['cleaning_level'],
            processing_time_ms=processing_time_ms,
            corrections=cleaned_result['metadata']['corrections'],
            context_detected=cleaned_result['metadata']['context_detected'],
            ai_model_used=cleaned_result['metadata']['ai_model_used'],
            timing_breakdown={'gemini_api_ms': gemini_time, 'total_ms': processing_time_ms},
            gemini_prompt=cleaned_result.get('prompt_used'),
            gemini_response=cleaned_result.get('raw_response')
        )
        
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        # Add to evaluation history
        turn_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_result['cleaned_text'],
            'confidence_score': cleaned_result['metadata']['confidence_score'],
            'cleaning_applied': cleaned_result['metadata']['cleaning_applied'],
            'cleaning_level': cleaned_result['metadata']['cleaning_level'],
            'processing_time_ms': processing_time_ms,
            'corrections': cleaned_result['metadata']['corrections'],
            'context_detected': cleaned_result['metadata']['context_detected'],
            'ai_model_used': cleaned_result['metadata']['ai_model_used']
        }
        
        evaluation_state.add_to_history(turn_data)
        
        # Update evaluation turns count
        evaluation.turns_processed += 1
        db.commit()
        
        self.performance_metrics['user_processing_times'].append(processing_time_ms)
        self.performance_metrics['total_user_turns'] += 1
        
        print(f"[EvaluationManager] ✅ User turn processed in {processing_time_ms:.2f}ms")
        print(f"[EvaluationManager] Cleaning applied: {cleaned_result['metadata']['cleaning_applied']}")
        print(f"[EvaluationManager] Confidence: {cleaned_result['metadata']['confidence_score']}")
        
        return {
            'cleaned_turn_id': str(cleaned_turn.id),
            'evaluation_id': str(evaluation.id),
            'turn_id': str(raw_turn.id),
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_result['cleaned_text'],
            'turn_sequence': raw_turn.turn_sequence,
            'metadata': {
                'confidence_score': cleaned_result['metadata']['confidence_score'],
                'cleaning_applied': cleaned_result['metadata']['cleaning_applied'],
                'cleaning_level': cleaned_result['metadata']['cleaning_level'],
                'processing_time_ms': processing_time_ms,
                'corrections': cleaned_result['metadata']['corrections'],
                'context_detected': cleaned_result['metadata']['context_detected'],
                'ai_model_used': cleaned_result['metadata']['ai_model_used']
            },
            'created_at': cleaned_turn.created_at.isoformat()
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for monitoring"""
        timing_metrics = {}
        
        # Process timing metrics (lists of times)
        timing_keys = ['lumen_processing_times', 'user_processing_times', 'transcription_error_processing_times', 
                      'context_retrieval_times', 'gemini_api_times', 'average_context_size', 'sliding_window_sizes']
        
        for metric_name in timing_keys:
            times = self.performance_metrics.get(metric_name, [])
            if times:
                timing_metrics[metric_name] = {
                    'avg': round(sum(times) / len(times), 2),
                    'max': round(max(times), 2),
                    'min': round(min(times), 2),
                    'count': len(times)
                }
            else:
                timing_metrics[metric_name] = {
                    'avg': 0,
                    'max': 0,
                    'min': 0,
                    'count': 0
                }
        
        # Process counter metrics (integers)
        total_turns = self.performance_metrics['total_turns_processed']
        
        return {
            'summary': {
                'total_turns_processed': total_turns,
                'total_lumen_turns': self.performance_metrics['total_lumen_turns'],
                'total_user_turns': self.performance_metrics['total_user_turns'],
                'total_transcription_errors': self.performance_metrics['total_transcription_errors'],
                'lumen_percentage': round((self.performance_metrics['total_lumen_turns'] / total_turns * 100), 1) if total_turns > 0 else 0,
                'user_percentage': round((self.performance_metrics['total_user_turns'] / total_turns * 100), 1) if total_turns > 0 else 0,
                'error_percentage': round((self.performance_metrics['total_transcription_errors'] / total_turns * 100), 1) if total_turns > 0 else 0
            },
            'timing_metrics': timing_metrics,
            'performance_targets': {
                'lumen_target_ms': 10,
                'user_target_ms': 500,
                'context_retrieval_target_ms': 100
            }
        }