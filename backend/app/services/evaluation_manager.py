"""
EvaluationManager - Core evaluation-based conversation processing

This manages the evaluation system where multiple evaluations can be run
on the same conversation with different prompts, settings, and approaches.
"""

import time
import logging
import asyncio
import json
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc
from concurrent.futures import ThreadPoolExecutor

from app.models.evaluation import Evaluation
from app.models.cleaned_turn import CleanedTurn
from app.models.conversation import Conversation
from app.models.turn import Turn
from app.models.user_variable_history import UserVariableHistory
from app.services.gemini_service import GeminiService
from app.services.prompt_engineering_service import PromptEngineeringService
from app.services.function_executor import FunctionExecutor
from app.services.function_registry import function_registry

logger = logging.getLogger(__name__)


class EvaluationState:
    """Manages the stateful context for a single evaluation"""
    
    def __init__(self, evaluation_id: UUID, cleaner_window_size: int = 10, 
                 function_window_size: int = 20, prompt_template: str = None,
                 function_prompt_template: str = None):
        self.evaluation_id = evaluation_id
        
        # Cleaner-specific fields
        self.cleaner_window_size = cleaner_window_size
        self.cleaned_history: List[Dict[str, Any]] = []
        self.prompt_template = prompt_template  # Cache the cleaner template
        
        # Function caller-specific fields
        self.function_window_size = function_window_size
        self.function_prompt_template = function_prompt_template  # Cache the function template
        self.function_call_history: List[Dict[str, Any]] = []  # ALL function calls made
        self.mirrored_customer = None  # Current customer state
        self.business_insights: Dict[str, Any] = {}  # Accumulated insights
        
        # Legacy support - keep sliding_window_size for backward compatibility
        self.sliding_window_size = cleaner_window_size
        
        print(f"[EvaluationState] Initialized for evaluation {evaluation_id}")
        print(f"[EvaluationState] Cleaner window size: {self.cleaner_window_size}")
        print(f"[EvaluationState] Function window size: {self.function_window_size}")
        if prompt_template:
            print(f"[EvaluationState] 🎯 Cached cleaner prompt template in memory")
        if function_prompt_template:
            print(f"[EvaluationState] 🎯 Cached function prompt template in memory")
    
    def get_cleaned_sliding_window(self) -> List[Dict[str, Any]]:
        """Get the cleaned conversation history for context (from THIS evaluation)"""
        print(f"[EvaluationState] 🔍 EVALUATION SLIDING WINDOW: Getting sliding window")
        print(f"[EvaluationState] 📊 Current history length: {len(self.cleaned_history)}")
        print(f"[EvaluationState] 🎯 Window size configured: {self.cleaner_window_size}")
        
        # Return last N turns of CLEANED conversation history from this evaluation
        window = self.cleaned_history[-self.cleaner_window_size:]
        
        print(f"[EvaluationState] ✂️ Sliding window contains {len(window)} turns")
        
        if len(window) > 0:
            print(f"[EvaluationState] 📋 Window contents:")
            for i, turn in enumerate(window):
                actual_turn_num = len(self.cleaned_history) - len(window) + i + 1
                print(f"[EvaluationState]   Window[{i}] (Turn {actual_turn_num}): {turn['speaker']} -> '{turn['cleaned_text'][:80]}...'")
        else:
            print(f"[EvaluationState] ❌ Window is empty!")
        
        return window
    
    def get_function_sliding_window(self) -> List[Dict[str, Any]]:
        """Get sliding window for function caller context (can be different size)"""
        print(f"[EvaluationState] 🔍 FUNCTION SLIDING WINDOW: Getting sliding window")
        print(f"[EvaluationState] 📊 Current history length: {len(self.cleaned_history)}")
        print(f"[EvaluationState] 🎯 Function window size: {self.function_window_size}")
        
        # Return last N turns for function context
        window = self.cleaned_history[-self.function_window_size:]
        
        print(f"[EvaluationState] ✂️ Function window contains {len(window)} turns")
        
        return window
    
    def get_previous_function_calls(self) -> List[Dict[str, Any]]:
        """Get all previous function calls for the prompt"""
        print(f"[EvaluationState] 📞 Getting previous function calls: {len(self.function_call_history)} total")
        return self.function_call_history
    
    def add_to_history(self, turn_data: Dict[str, Any]):
        """Add a processed cleaned turn to the evaluation history"""
        print(f"[EvaluationState] Adding cleaned turn to evaluation history: {turn_data['speaker']}")
        print(f"[EvaluationState] Raw text: '{turn_data['raw_text'][:100]}...'")
        print(f"[EvaluationState] Cleaned text: '{turn_data['cleaned_text'][:100]}...'")
        
        self.cleaned_history.append(turn_data)
        
        print(f"[EvaluationState] Evaluation history now contains {len(self.cleaned_history)} cleaned turns")
    
    def add_function_call(self, function_call_data: Dict[str, Any]):
        """Add a function call to the history"""
        print(f"[EvaluationState] Adding function call: {function_call_data['function_name']}")
        self.function_call_history.append(function_call_data)
        print(f"[EvaluationState] Function call history now contains {len(self.function_call_history)} calls")


class EvaluationManager:
    """
    Core evaluation management with CleanerContext processing.
    
    Key Innovation: Each evaluation has its own cleaned history and context window.
    Multiple evaluations of the same conversation can use different cleaning approaches.
    """
    
    def __init__(self):
        self.active_evaluations: Dict[UUID, EvaluationState] = {}
        self.stopped_evaluations: Dict[UUID, bool] = {}  # Track stopped evaluations
        self.gemini_service = GeminiService()
        self.prompt_service = PromptEngineeringService()
        self.function_executor = FunctionExecutor()
        self.function_registry = function_registry
        self.db_executor = ThreadPoolExecutor(max_workers=4)  # For async DB operations
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
        print("[EvaluationManager] Async DB executor initialized")
    
    async def create_evaluation(self, conversation_id: UUID, name: str, user_id: UUID, 
                              description: str = None, prompt_template: str = None, 
                              prompt_template_id: UUID = None, settings: Dict[str, Any] = None, 
                              db: Session = None) -> Evaluation:
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
            prompt_template_id=prompt_template_id,
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
            
            # Load evaluation to get the prompt templates and settings
            evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
            prompt_template = None
            function_prompt_template = None
            cleaner_window_size = sliding_window_size
            function_window_size = 20  # Default function window size
            
            if evaluation:
                # Get cleaner prompt template
                if evaluation.prompt_template_id:
                    # Fetch template from database once and cache it
                    template_obj = self.prompt_service.get_template_by_id_sync(evaluation.prompt_template_id, db)
                    if template_obj:
                        prompt_template = template_obj.template
                        print(f"[EvaluationManager] 🎯 Loaded cleaner template for caching: {template_obj.name}")
                elif evaluation.prompt_template:
                    # Use legacy hardcoded template
                    prompt_template = evaluation.prompt_template
                    print(f"[EvaluationManager] 📝 Using legacy cleaner template for caching")
                
                # Get function prompt template from settings
                function_params = evaluation.settings.get('function_params', {}) if evaluation.settings else {}
                if function_params.get('prompt_template_id'):
                    function_template_obj = self.prompt_service.get_function_template_by_id_sync(
                        function_params['prompt_template_id'], db
                    )
                    if function_template_obj:
                        function_prompt_template = function_template_obj.template
                        print(f"[EvaluationManager] 🎯 Loaded function template for caching: {function_template_obj.name}")
                
                # Get window sizes from settings
                if evaluation.settings:
                    cleaner_window_size = evaluation.settings.get('sliding_window', cleaner_window_size)
                    function_window_size = evaluation.settings.get('function_sliding_window', function_window_size)
            
            self.active_evaluations[evaluation_id] = EvaluationState(
                evaluation_id, 
                cleaner_window_size, 
                function_window_size,
                prompt_template,
                function_prompt_template
            )
            
            # Load existing cleaned turns from database to rebuild context
            self._load_existing_evaluation_context(evaluation_id, db)
            
            # Load mirrored customer if exists
            self._load_mirrored_customer(evaluation_id, db)
            
            # Load existing function calls from database
            self._load_existing_function_calls(evaluation_id, db)
        else:
            print(f"[EvaluationManager] Using existing evaluation state for {evaluation_id}")
            # Update sliding window size if provided
            if sliding_window_size != 10:
                self.active_evaluations[evaluation_id].cleaner_window_size = sliding_window_size
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
    
    def _load_mirrored_customer(self, evaluation_id: UUID, db: Session = None):
        """Load mirrored customer from database to evaluation state"""
        if not db:
            return
        
        try:
            from app.models.mock_customer import MirroredMockCustomer
            
            mirrored_customer = db.query(MirroredMockCustomer).filter(
                MirroredMockCustomer.evaluation_id == evaluation_id
            ).first()
            
            if mirrored_customer:
                evaluation_state = self.active_evaluations.get(evaluation_id)
                if evaluation_state:
                    evaluation_state.mirrored_customer = mirrored_customer
                    print(f"[EvaluationManager] 👤 Loaded mirrored customer: {mirrored_customer.company_name}")
            else:
                print(f"[EvaluationManager] 👤 No mirrored customer found for evaluation {evaluation_id}")
                
        except Exception as e:
            print(f"[EvaluationManager] ❌ Failed to load mirrored customer: {e}")
    
    def _create_mirrored_customer_from_default(self, evaluation_id: UUID, db: Session = None):
        """Create a mirrored customer from the default customer for this evaluation"""
        if not db:
            return None
        
        try:
            from app.models.mock_customer import MockCustomer, MirroredMockCustomer
            
            # Find the default customer
            default_customer = db.query(MockCustomer).filter(MockCustomer.is_default == True).first()
            
            if not default_customer:
                print(f"[EvaluationManager] ❌ No default customer found")
                return None
            
            # Create mirrored customer from default
            mirrored_customer = MirroredMockCustomer.from_mock_customer(default_customer, evaluation_id)
            
            # Save to database
            db.add(mirrored_customer)
            db.commit()
            db.refresh(mirrored_customer)
            
            print(f"[EvaluationManager] ✅ Created mirrored customer from default: {mirrored_customer.company_name}")
            return mirrored_customer
            
        except Exception as e:
            print(f"[EvaluationManager] ❌ Failed to create mirrored customer from default: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _load_existing_function_calls(self, evaluation_id: UUID, db: Session = None):
        """Load existing function calls from database to rebuild function call history"""
        if not db:
            return
        
        try:
            from app.models.called_function import CalledFunction
            
            # Query existing function calls for this evaluation, ordered by creation
            existing_function_calls = db.query(CalledFunction).filter(
                CalledFunction.evaluation_id == evaluation_id
            ).order_by(CalledFunction.created_at.asc()).all()
            
            print(f"[EvaluationManager] 📞 Found {len(existing_function_calls)} existing function calls")
            
            if not existing_function_calls:
                return
            
            evaluation_state = self.active_evaluations.get(evaluation_id)
            if not evaluation_state:
                return
            
            # Convert function calls to history format
            for func_call in existing_function_calls:
                function_data = {
                    'turn_id': str(func_call.turn_id),
                    'function_name': func_call.function_name,
                    'parameters': func_call.parameters,
                    'result': func_call.result,
                    'executed': func_call.executed,
                    'confidence_score': func_call.confidence_score,
                    'timestamp': func_call.created_at.isoformat()
                }
                evaluation_state.add_function_call(function_data)
            
            print(f"[EvaluationManager] ✅ Loaded {len(existing_function_calls)} function calls into history")
                
        except Exception as e:
            print(f"[EvaluationManager] ❌ Failed to load existing function calls: {e}")
            import traceback
            traceback.print_exc()
    
    def _save_to_db_async(self, func, *args, **kwargs):
        """Execute database operations asynchronously without blocking"""
        def _db_operation():
            try:
                func(*args, **kwargs)
            except Exception as e:
                logger.error(f"Async DB operation failed: {e}")
        
        # Submit to executor - returns immediately
        future = self.db_executor.submit(_db_operation)
        # Don't wait for result - fire and forget
        return future
    
    async def _process_function_calls(
        self,
        evaluation_state: EvaluationState,
        cleaned_result: Dict[str, Any],
        raw_turn,
        db: Session,
        timing: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Process function calls after cleaning"""
        function_timing = timing or {}
        
        print(f"[EvaluationManager] 🔧 Processing function calls for cleaned text")
        
        # Check if function prompt template is available
        if not evaluation_state.function_prompt_template:
            print(f"[EvaluationManager] ❌ No function prompt template available, skipping function calls")
            return []
        
        # Ensure mirrored customer exists - create if needed
        if not evaluation_state.mirrored_customer:
            print(f"[EvaluationManager] 👤 No mirrored customer found, creating from default customer")
            mirrored_customer = self._create_mirrored_customer_from_default(evaluation_state.evaluation_id, db)
            if mirrored_customer:
                evaluation_state.mirrored_customer = mirrored_customer
                print(f"[EvaluationManager] ✅ Created mirrored customer: {mirrored_customer.company_name}")
            else:
                print(f"[EvaluationManager] ❌ Failed to create mirrored customer, skipping function calls")
                return []
        
        try:
            function_timing['function_context_start'] = time.time()
            
            # Build function calling context
            context = self._build_function_context(evaluation_state)
            
            function_timing['function_context_end'] = time.time()
            function_timing['function_prompt_start'] = time.time()
            
            # Render function prompt template with variables
            template_variables = {
                'call_context': context['call_context'],
                'cleaned_conversation': context['cleaned_conversation'],
                'available_functions': context['available_functions'],
                'previous_function_calls': context['previous_function_calls']
            }
            
            rendered_prompt = evaluation_state.function_prompt_template.format(**template_variables)
            
            function_timing['function_prompt_end'] = time.time()
            function_timing['function_gemini_start'] = time.time()
            
            # Call Gemini for function decision using same service
            function_response = await self.gemini_service.clean_conversation_turn(
                raw_text=cleaned_result['cleaned_text'],
                speaker=raw_turn.speaker,
                cleaned_context=[],  # Not used for function calling
                cleaning_level="full",
                model_params=None,
                rendered_prompt=rendered_prompt
            )
            
            function_timing['function_gemini_end'] = time.time()
            function_timing['function_parse_start'] = time.time()
            
            # Parse response expecting JSON with thought_process and function_calls
            try:
                response_text = function_response.get('cleaned_text', '').strip()
                if not response_text:
                    print(f"[EvaluationManager] ❌ Empty response from function calling Gemini")
                    return []
                
                decision = json.loads(response_text)
                print(f"[EvaluationManager] 🧠 Function decision: {decision.get('thought_process', 'No reasoning provided')}")
                
            except json.JSONDecodeError as e:
                print(f"[EvaluationManager] ❌ Failed to parse function decision JSON: {e}")
                print(f"[EvaluationManager] Raw response: {response_text}")
                return []
            
            function_timing['function_parse_end'] = time.time()
            function_timing['function_execute_start'] = time.time()
            
            # Execute functions if any
            executed_functions = []
            function_calls = decision.get('function_calls', [])
            
            if function_calls:
                print(f"[EvaluationManager] 🔧 Executing {len(function_calls)} function calls")
                
                for func_call in function_calls:
                    # Execute function
                    result = await self._execute_single_function(
                        func_call, evaluation_state, cleaned_result, raw_turn, db, 
                        thought_process=decision.get('thought_process')
                    )
                    executed_functions.append(result)
                    
                    # Add to function call history in memory (immediate update)
                    function_data = {
                        'turn_id': str(raw_turn.id),
                        'turn_sequence': raw_turn.turn_sequence,
                        'function_name': func_call['name'],
                        'parameters': func_call['parameters'],
                        'result': result.get('result'),
                        'executed': result.get('success', False),
                        'confidence_score': 'MEDIUM',  # Default for now
                        'timestamp': time.time()
                    }
                    evaluation_state.add_function_call(function_data)
            
            function_timing['function_execute_end'] = time.time()
            
            print(f"[EvaluationManager] ✅ Function calling completed: {len(executed_functions)} functions executed")
            return executed_functions
            
        except Exception as e:
            print(f"[EvaluationManager] ❌ Function calling failed: {e}")
            logger.error(f"Function calling error: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def _build_function_context(self, evaluation_state: EvaluationState) -> Dict[str, Any]:
        """Build context for function calling prompt"""
        
        # Get cleaned conversation with function-specific window size
        cleaned_conversation = evaluation_state.get_function_sliding_window()
        
        # Format conversation for prompt
        conversation_str = "\n".join([
            f"{turn['speaker']}: {turn['cleaned_text']}"
            for turn in cleaned_conversation
        ])
        
        # Get all previous function calls
        previous_calls = evaluation_state.get_previous_function_calls()
        
        # Format previous function calls
        if previous_calls:
            previous_calls_str = json.dumps(previous_calls, indent=2)
        else:
            previous_calls_str = "[]"
        
        # Get current customer state (call_context)
        if evaluation_state.mirrored_customer:
            call_context = {
                'company_size': evaluation_state.mirrored_customer.company_size,
                'job_title': evaluation_state.mirrored_customer.job_title,
                'company_sector': evaluation_state.mirrored_customer.company_sector,
                'company_name': evaluation_state.mirrored_customer.company_name,
                'company_description': evaluation_state.mirrored_customer.company_description,
                'user_name': evaluation_state.mirrored_customer.user_name,
                'business_insights': evaluation_state.mirrored_customer.business_insights or {}
            }
        else:
            call_context = {}
        
        return {
            'call_context': json.dumps(call_context, indent=2),
            'cleaned_conversation': conversation_str,
            'available_functions': self.function_registry.get_functions_catalog(),
            'previous_function_calls': previous_calls_str
        }
    
    async def _execute_single_function(
        self,
        func_call: Dict[str, Any],
        evaluation_state: EvaluationState,
        cleaned_result: Dict[str, Any],
        raw_turn,
        db: Session,
        thought_process: str = None
    ) -> Dict[str, Any]:
        """Execute a single function and create database record"""
        
        function_name = func_call['name']
        parameters = func_call['parameters']
        
        print(f"[EvaluationManager] 🔧 Executing function: {function_name}")
        
        try:
            # Execute function using function executor
            execution_result = await self.function_executor.execute_function(
                function_name=function_name,
                parameters=parameters,
                mirrored_customer=evaluation_state.mirrored_customer,
                db=db
            )
            
            # Create CalledFunction record in database (async to not block)
            self._save_function_call_async(
                evaluation_state.evaluation_id,
                raw_turn.id,
                function_name,
                parameters,
                execution_result,
                db,
                thought_process=thought_process
            )
            
            return {
                'function_name': function_name,
                'parameters': parameters,
                'success': execution_result.get('success', False),
                'result': execution_result.get('result'),
                'execution_time_ms': execution_result.get('execution_time_ms', 0),
                'changes_made': execution_result.get('changes_made', [])
            }
            
        except Exception as e:
            print(f"[EvaluationManager] ❌ Function execution failed: {e}")
            return {
                'function_name': function_name,
                'parameters': parameters,
                'success': False,
                'error': str(e),
                'execution_time_ms': 0
            }
    
    def _save_function_call_async(
        self,
        evaluation_id: UUID,
        turn_id: UUID,
        function_name: str,
        parameters: Dict[str, Any],
        execution_result: Dict[str, Any],
        db: Session,  # Not used anymore, kept for compatibility
        thought_process: str = None
    ):
        """Save function call to database asynchronously with separate session"""
        def _save_function_call():
            # Create a new session for this operation
            from app.core.database import SessionLocal
            new_db = SessionLocal()
            
            try:
                from app.models.called_function import CalledFunction
                
                called_function = CalledFunction(
                    evaluation_id=evaluation_id,
                    turn_id=turn_id,
                    function_name=function_name,
                    parameters=parameters,
                    result=execution_result.get('result'),
                    executed=execution_result.get('success', False),
                    confidence_score='MEDIUM',  # Default for now
                    decision_reasoning=thought_process,  # Map thought_process to decision_reasoning
                    processing_time_ms=execution_result.get('execution_time_ms', 0),
                    mock_data_before=execution_result.get('before_state'),
                    mock_data_after=execution_result.get('after_state')
                )
                
                new_db.add(called_function)
                new_db.commit()
                print(f"[EvaluationManager] 💾 Saved function call to database: {function_name}")
                
            except Exception as e:
                print(f"[EvaluationManager] ❌ Failed to save function call: {e}")
                new_db.rollback()
            finally:
                # Always close the session
                new_db.close()
        
        # Execute async without blocking
        self._save_to_db_async(_save_function_call)
    
    async def process_turn(self, evaluation_id: UUID, turn_id: UUID, db: Session,
                          override_settings: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a raw turn through this evaluation's cleaning approach.
        
        This creates a cleaned turn linked to both the evaluation and the raw turn.
        """
        # Check if evaluation has been stopped
        if self.is_evaluation_stopped(evaluation_id):
            print(f"[EvaluationManager] ❌ Evaluation {evaluation_id} has been stopped, skipping turn {turn_id}")
            raise Exception(f"Evaluation {evaluation_id} has been stopped")
        
        # Comprehensive timing breakdown
        timing = {
            'request_received_at': time.time(),
            'database_query_start': 0,
            'database_query_end': 0,
            'settings_preparation_start': 0,
            'settings_preparation_end': 0,
            'context_retrieval_start': 0,
            'context_retrieval_end': 0,
            'processing_decision_start': 0,
            'processing_decision_end': 0,
            'cleaning_start': 0,
            'cleaning_end': 0,
            'database_save_start': 0,
            'database_save_end': 0,
            'context_update_start': 0,
            'context_update_end': 0,
            'response_preparation_start': 0,
            'response_preparation_end': 0,
            # NEW: Granular timing fields
            'prompt_preparation_start': 0,
            'prompt_preparation_end': 0,
            'gemini_api_start': 0,
            'gemini_api_end': 0,
            'gemini_network_start': 0,
            'gemini_network_end': 0,
            'response_parsing_start': 0,
            'response_parsing_end': 0,
            'websocket_broadcast_start': 0,
            'websocket_broadcast_end': 0,
            # Database query breakdown
            'db_queries': {
                'evaluation_fetch': {'start': 0, 'end': 0},
                'turn_fetch': {'start': 0, 'end': 0},
                'context_fetch': {'start': 0, 'end': 0},
                'save_operation': {'start': 0, 'end': 0}
            }
        }
        
        start_time = time.time()
        
        # Step 1: Database queries
        timing['database_query_start'] = time.time()
        
        # Evaluation fetch
        timing['db_queries']['evaluation_fetch']['start'] = time.time()
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        timing['db_queries']['evaluation_fetch']['end'] = time.time()
        if not evaluation:
            raise ValueError(f"Evaluation {evaluation_id} not found")
        
        # Turn fetch
        timing['db_queries']['turn_fetch']['start'] = time.time()
        raw_turn = db.query(Turn).filter(Turn.id == turn_id).first()
        timing['db_queries']['turn_fetch']['end'] = time.time()
        if not raw_turn:
            raise ValueError(f"Turn {turn_id} not found")
        
        timing['database_query_end'] = time.time()
        
        # Step 2: Settings preparation
        timing['settings_preparation_start'] = time.time()
        settings = evaluation.settings.copy() if evaluation.settings else {}
        if override_settings:
            settings.update(override_settings)
        
        sliding_window_size = settings.get('sliding_window', 10)
        cleaning_level = settings.get('cleaning_level', 'full')
        model_params = settings.get('model_params')
        timing['settings_preparation_end'] = time.time()
        
        print(f"\n🔄 CLEANERCONTEXT PROCESSING: {raw_turn.speaker}")
        print(f"📝 Raw Text: '{raw_turn.raw_text[:80]}...'")
        print(f"⚙️ Evaluation: {evaluation.name} | Cleaning Level: {cleaning_level}")
        
        # Step 3: Context retrieval
        timing['context_retrieval_start'] = time.time()
        
        # Context fetch from database
        timing['db_queries']['context_fetch']['start'] = time.time()
        evaluation_state = self.get_evaluation_state(evaluation_id, sliding_window_size, db)
        cleaned_context = evaluation_state.get_cleaned_sliding_window()
        timing['db_queries']['context_fetch']['end'] = time.time()
        
        timing['context_retrieval_end'] = time.time()
        
        print(f"🔍 Context Window: {len(cleaned_context)} turns (window size: {sliding_window_size})")
        
        # Step 4: Processing decision (determine which path to take)
        timing['processing_decision_start'] = time.time()
        is_lumen = self._is_lumen_turn(raw_turn.speaker)
        is_transcription_error = self._is_likely_transcription_error(raw_turn.raw_text)
        timing['processing_decision_end'] = time.time()
        
        # Step 5: Actual cleaning/processing
        timing['cleaning_start'] = time.time()
        if is_lumen:
            print(f"🚀 LUMEN BYPASS: Perfect AI response, no cleaning needed")
            result = await self._process_lumen_turn(evaluation, raw_turn, evaluation_state, db, timing)
        elif is_transcription_error:
            print(f"🚫 TRANSCRIPTION ERROR: Skipping garbled/foreign text")
            result = await self._process_transcription_error(evaluation, raw_turn, evaluation_state, db, timing)
        else:
            print(f"👤 USER TURN: Applying full CleanerContext intelligence")
            result = await self._process_user_turn(evaluation, raw_turn, evaluation_state, db, 
                                                 cleaned_context, cleaning_level, model_params, timing)
        timing['cleaning_end'] = time.time()
        
        # Step 6: Function calling (NEW)
        timing['function_calling_start'] = time.time()
        function_call_results = []
        
        # Only process function calls for user turns that were successfully cleaned
        if not is_lumen and not is_transcription_error and result.get('cleaned_text'):
            print(f"🔧 FUNCTION CALLING: Processing potential function calls")
            function_call_results = await self._process_function_calls(
                evaluation_state, result, raw_turn, db, timing
            )
            
            # Add function calls to result
            result['function_calls'] = function_call_results
        else:
            print(f"🔧 FUNCTION CALLING: Skipped for {raw_turn.speaker} turn")
            result['function_calls'] = []
        
        timing['function_calling_end'] = time.time()
        
        # Step 7: Response preparation
        timing['response_preparation_start'] = time.time()
        
        # Calculate comprehensive timing breakdown
        total_time = (time.time() - start_time) * 1000
        timing_breakdown = {
            'database_query_ms': round((timing['database_query_end'] - timing['database_query_start']) * 1000, 2),
            'settings_preparation_ms': round((timing['settings_preparation_end'] - timing['settings_preparation_start']) * 1000, 2),
            'context_retrieval_ms': round((timing['context_retrieval_end'] - timing['context_retrieval_start']) * 1000, 2),
            'processing_decision_ms': round((timing['processing_decision_end'] - timing['processing_decision_start']) * 1000, 2),
            'cleaning_processing_ms': round((timing['cleaning_end'] - timing['cleaning_start']) * 1000, 2),
            'function_calling_ms': round((timing['function_calling_end'] - timing['function_calling_start']) * 1000, 2),
            'total_ms': round(total_time, 2),
            # Add granular database timings
            'db_queries_breakdown': {
                'evaluation_fetch_ms': round((timing['db_queries']['evaluation_fetch']['end'] - timing['db_queries']['evaluation_fetch']['start']) * 1000, 2) if timing['db_queries']['evaluation_fetch']['end'] > 0 else 0,
                'turn_fetch_ms': round((timing['db_queries']['turn_fetch']['end'] - timing['db_queries']['turn_fetch']['start']) * 1000, 2) if timing['db_queries']['turn_fetch']['end'] > 0 else 0,
                'context_fetch_ms': round((timing['db_queries']['context_fetch']['end'] - timing['db_queries']['context_fetch']['start']) * 1000, 2) if timing['db_queries']['context_fetch']['end'] > 0 else 0
            }
        }
        
        # Add PURE Gemini timing if available
        if timing['gemini_network_end'] > 0 and timing['gemini_network_start'] > 0:
            timing_breakdown['gemini_pure_api_ms'] = round((timing['gemini_network_end'] - timing['gemini_network_start']) * 1000, 2)
            print(f"\n⚡ PURE Gemini API time: {timing_breakdown['gemini_pure_api_ms']}ms")
        
        # Add cleaning-specific timing from the result if available
        if 'timing_breakdown' in result and result['timing_breakdown']:
            # Merge the detailed cleaning timing with our main timing
            detailed_timing = result['timing_breakdown']
            
            # PRESERVE the main total_ms - don't let it get overwritten
            main_total_ms = timing_breakdown['total_ms']
            
            # Merge detailed timing (but not total_ms)
            for key, value in detailed_timing.items():
                if key != 'total_ms':  # Don't overwrite the main total
                    timing_breakdown[key] = value
            
            # Keep the main total
            timing_breakdown['total_ms'] = main_total_ms
            
            # For user turns, we want to see the detailed breakdown
            if 'gemini_api_ms' in detailed_timing:
                timing_breakdown['step_breakdown'] = {
                    'prompt_preparation_ms': detailed_timing.get('prompt_preparation_ms', 0),
                    'gemini_api_ms': detailed_timing.get('gemini_api_ms', 0),
                    'database_save_ms': detailed_timing.get('database_save_ms', 0),
                    'context_update_ms': detailed_timing.get('context_update_ms', 0)
                }
        
        # Update result with comprehensive timing
        result['timing_breakdown'] = timing_breakdown
        
        # Also update the processing_time_ms to match total_ms for consistency
        if 'metadata' in result:
            result['metadata']['processing_time_ms'] = timing_breakdown['total_ms']
        
        timing['response_preparation_end'] = time.time()
        
        total_time = (time.time() - start_time) * 1000
        
        # Track performance metrics
        self.performance_metrics['total_turns_processed'] += 1
        context_size = len(cleaned_context)
        self.performance_metrics['average_context_size'].append(context_size)
        self.performance_metrics['sliding_window_sizes'].append(sliding_window_size)
        
        # Log detailed timing breakdown
        print(f"\n🔬 DETAILED TIMING BREAKDOWN:")
        print(f"  └─ Total Request Time: {total_time:.2f}ms")
        print(f"     ├─ Database Queries: {timing_breakdown['database_query_ms']:.2f}ms")
        if timing_breakdown.get('db_queries_breakdown'):
            for query_name, query_time in timing_breakdown['db_queries_breakdown'].items():
                if query_time > 0:
                    print(f"     │  └─ {query_name}: {query_time:.2f}ms")
        print(f"     ├─ Settings Prep: {timing_breakdown['settings_preparation_ms']:.2f}ms")
        print(f"     ├─ Context Retrieval: {timing_breakdown['context_retrieval_ms']:.2f}ms")
        print(f"     ├─ Processing Decision: {timing_breakdown['processing_decision_ms']:.2f}ms")
        print(f"     ├─ Cleaning Processing: {timing_breakdown['cleaning_processing_ms']:.2f}ms")
        print(f"     └─ Function Calling: {timing_breakdown['function_calling_ms']:.2f}ms")
        if 'gemini_pure_api_ms' in timing_breakdown:
            print(f"        └─ PURE Gemini API: {timing_breakdown['gemini_pure_api_ms']:.2f}ms ⚡")
        
        print(f"\n[EvaluationManager] ===== TURN COMPLETE in {total_time:.2f}ms =====\n")
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
                                         evaluation_state: EvaluationState, db: Session, timing: Dict[str, float] = None) -> Dict[str, Any]:
        """Handle transcription errors by creating cleaned turn with skip metadata"""
        process_start = time.time()
        error_timing = timing or {}
        
        print(f"[EvaluationManager] 🚫 Processing transcription error with skip")
        
        # Skip cleaning - create cleaned turn with empty text and error metadata
        cleaned_text = ""  # Empty indicates skipped
        
        # Track database save timing
        error_timing['database_save_start'] = time.time()
        
        # Create cleaned turn record with error metadata
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_text,
            confidence_score='LOW',
            cleaning_applied='true',  # We did apply "cleaning" by removing gibberish
            cleaning_level='skip',
            processing_time_ms=0,  # Will update with actual time
            corrections=[{
                'original': raw_turn.raw_text,
                'corrected': '',
                'confidence': 'HIGH',
                'reason': 'Detected as transcription error - likely foreign characters or gibberish'
            }],
            context_detected='transcription_error',
            ai_model_used="bypass",
            timing_breakdown={},  # Will update with actual timing
            gemini_prompt=None,
            gemini_response=None
        )
        
        # Save to database
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        error_timing['database_save_end'] = time.time()
        
        # Track context update timing
        error_timing['context_update_start'] = time.time()
        
        # Add to evaluation history (with empty cleaned text to not pollute context)
        context_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'LOW',
            'cleaning_applied': True,
            'cleaning_level': 'skip',
            'processing_time_ms': 0,  # Will update
            'corrections': cleaned_turn.corrections,
            'context_detected': 'transcription_error',
            'ai_model_used': None
        }
        evaluation_state.add_to_history(context_data)
        
        error_timing['context_update_end'] = time.time()
        
        actual_processing_time = (time.time() - process_start) * 1000
        
        # Calculate detailed timing breakdown for error turns
        error_timing_breakdown = {
            # Infrastructure timing from main process_turn
            'database_query_ms': self._safe_timing_diff('database_query_end', 'database_query_start', timing),
            'settings_preparation_ms': self._safe_timing_diff('settings_preparation_end', 'settings_preparation_start', timing),
            'context_retrieval_ms': self._safe_timing_diff('context_retrieval_end', 'context_retrieval_start', timing),
            'processing_decision_ms': self._safe_timing_diff('processing_decision_end', 'processing_decision_start', timing),
            
            # Error-specific timing
            'prompt_preparation_ms': 0,  # No prompt for errors
            'gemini_api_ms': 0,  # No Gemini call for errors
            'database_save_ms': self._safe_timing_diff('database_save_end', 'database_save_start', error_timing),
            'context_update_ms': self._safe_timing_diff('context_update_end', 'context_update_start', error_timing),
            
            # Total cleaning processing time
            'cleaning_processing_ms': round(
                self._safe_timing_diff('database_save_end', 'database_save_start', error_timing) +
                self._safe_timing_diff('context_update_end', 'context_update_start', error_timing),
                2
            ),
            'total_ms': round(actual_processing_time, 2)
        }
        
        # Update the cleaned turn with actual timing
        cleaned_turn.processing_time_ms = actual_processing_time
        cleaned_turn.timing_breakdown = error_timing_breakdown
        db.commit()
        
        self.performance_metrics['transcription_error_processing_times'].append(actual_processing_time)
        self.performance_metrics['total_transcription_errors'] += 1
        
        print(f"[EvaluationManager] ✅ Transcription error processed in {actual_processing_time:.2f}ms")
        print(f"   - Database Save: {error_timing_breakdown['database_save_ms']:.2f}ms")
        print(f"   - Context Update: {error_timing_breakdown['context_update_ms']:.2f}ms")
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
            'created_at': cleaned_turn.created_at.isoformat(),
            'gemini_prompt': cleaned_turn.gemini_prompt,
            'gemini_response': cleaned_turn.gemini_response,
            'timing_breakdown': error_timing_breakdown
        }
    
    async def _process_lumen_turn(self, evaluation: Evaluation, raw_turn: Turn, 
                                evaluation_state: EvaluationState, db: Session, timing: Dict[str, float] = None) -> Dict[str, Any]:
        """Process Lumen turns with instant bypass"""
        process_start = time.time()
        lumen_timing = timing or {}
        
        print(f"[EvaluationManager] 🚀 Processing Lumen turn with instant bypass")
        
        # Lumen turns are perfect - no cleaning needed
        cleaned_text = raw_turn.raw_text
        
        # Track database save timing
        lumen_timing['database_save_start'] = time.time()
        
        # Create cleaned turn record
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_text,
            confidence_score='HIGH',
            cleaning_applied='false',
            cleaning_level='none',
            processing_time_ms=0,  # Will update with actual time
            corrections=[],
            context_detected='ai_response',
            ai_model_used="bypass",
            timing_breakdown={},  # Will update with actual timing
            gemini_prompt=None,
            gemini_response=None
        )
        
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        lumen_timing['database_save_end'] = time.time()
        
        # Track context update timing
        lumen_timing['context_update_start'] = time.time()
        
        # Add to evaluation history
        turn_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_text,
            'confidence_score': 'HIGH',
            'cleaning_applied': 'false',
            'cleaning_level': 'none',
            'processing_time_ms': 0,  # Will update
            'corrections': [],
            'context_detected': 'ai_response',
            'ai_model_used': None
        }
        
        evaluation_state.add_to_history(turn_data)
        
        # Update evaluation turns count
        evaluation.turns_processed += 1
        db.commit()
        
        lumen_timing['context_update_end'] = time.time()
        
        actual_processing_time = (time.time() - process_start) * 1000
        
        # Calculate detailed timing breakdown for Lumen turns
        lumen_timing_breakdown = {
            # Infrastructure timing from main process_turn
            'database_query_ms': self._safe_timing_diff('database_query_end', 'database_query_start', timing),
            'settings_preparation_ms': self._safe_timing_diff('settings_preparation_end', 'settings_preparation_start', timing),
            'context_retrieval_ms': self._safe_timing_diff('context_retrieval_end', 'context_retrieval_start', timing),
            'processing_decision_ms': self._safe_timing_diff('processing_decision_end', 'processing_decision_start', timing),
            
            # Lumen-specific timing
            'prompt_preparation_ms': 0,  # No prompt for Lumen
            'gemini_api_ms': 0,  # No Gemini call for Lumen
            'database_save_ms': self._safe_timing_diff('database_save_end', 'database_save_start', lumen_timing),
            'context_update_ms': self._safe_timing_diff('context_update_end', 'context_update_start', lumen_timing),
            
            # Total cleaning processing time (just DB save + context update for Lumen)
            'cleaning_processing_ms': round(
                self._safe_timing_diff('database_save_end', 'database_save_start', lumen_timing) +
                self._safe_timing_diff('context_update_end', 'context_update_start', lumen_timing),
                2
            ),
            'total_ms': round(actual_processing_time, 2)
        }
        
        # Update the cleaned turn with actual timing
        cleaned_turn.processing_time_ms = actual_processing_time
        cleaned_turn.timing_breakdown = lumen_timing_breakdown
        db.commit()
        
        self.performance_metrics['lumen_processing_times'].append(actual_processing_time)
        self.performance_metrics['total_lumen_turns'] += 1
        
        print(f"[EvaluationManager] ✅ Lumen turn processed in {actual_processing_time:.2f}ms")
        print(f"   - Database Save: {lumen_timing_breakdown['database_save_ms']:.2f}ms")
        print(f"   - Context Update: {lumen_timing_breakdown['context_update_ms']:.2f}ms")
        
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
            'created_at': cleaned_turn.created_at.isoformat(),
            'gemini_prompt': cleaned_turn.gemini_prompt,
            'gemini_response': cleaned_turn.gemini_response,
            'timing_breakdown': lumen_timing_breakdown
        }
    
    def _safe_timing_diff(self, end_key: str, start_key: str, timing_dict: Dict[str, float], fallback_start: float = 0) -> float:
        """Safely calculate timing differences, ensuring non-negative results"""
        end_time = timing_dict.get(end_key, 0)
        start_time = timing_dict.get(start_key, fallback_start)
        if end_time == 0 or start_time == 0:
            return 0
        diff_ms = (end_time - start_time) * 1000
        return round(max(0, diff_ms), 2)  # Ensure non-negative

    async def _process_user_turn(self, evaluation: Evaluation, raw_turn: Turn,
                               evaluation_state: EvaluationState, db: Session,
                               cleaned_context: List[Dict[str, Any]], cleaning_level: str,
                               model_params: Dict[str, Any] = None, timing: Dict[str, float] = None) -> Dict[str, Any]:
        """Process user turns with full CleanerContext intelligence"""
        process_start = time.time()
        user_timing = timing or {}
        
        print(f"🤖 GEMINI PROCESSING: Calling Gemini 2.5 Flash-Lite for cleaning...")
        
        # Detailed timing for user turn processing - start before actual work begins
        user_timing['prompt_preparation_start'] = time.time()
        
        # Use cached prompt template from evaluation state (no DB hit!)
        prompt_template = evaluation_state.prompt_template
        
        # Evaluation MUST have a prompt template - no fallbacks allowed
        if not prompt_template:
            raise ValueError(f"Evaluation {evaluation.id} has no prompt template available. Cannot process turn.")
        
        print(f"[EvaluationManager] 🚀 Using cached prompt template (zero-latency)")
        
        # Build context string for the prompt variables
        context_str = ""
        if cleaned_context:
            context_str = "\n".join([
                f"{turn['speaker']}: {turn['cleaned_text']}" 
                for turn in cleaned_context
            ])
        
        # Prepare variables for template rendering
        # Get user-provided variables from evaluation settings
        user_variables = evaluation.settings.get('user_variables', {}) if evaluation.settings else {}
        
        # Debug: Show what variables we got from evaluation settings
        print(f"[EvaluationManager] 🔍 DEBUG: Evaluation settings: {evaluation.settings}")
        print(f"[EvaluationManager] 🔍 DEBUG: Extracted user_variables: {user_variables}")
        print(f"[EvaluationManager] 🔍 DEBUG: User ID: {evaluation.user_id}")
        
        # Save user variables to history for future suggestions (if any are provided)
        if user_variables:
            print(f"[EvaluationManager] 💾 Found user variables to save: {user_variables}")
            await self._save_user_variables_to_history(evaluation.user_id, user_variables, db)
        else:
            print(f"[EvaluationManager] ❌ No user variables found in evaluation settings")
        
        template_variables = {
            "raw_text": raw_turn.raw_text,
            "conversation_context": context_str,
            "cleaning_level": cleaning_level,
            "call_context": user_variables.get("call_context", ""),  # From user input
            "additional_context": user_variables.get("additional_context", "")  # From user input
        }
        
        # Render the prompt template with variables
        try:
            rendered_prompt = prompt_template.format(**template_variables)
            print(f"[EvaluationManager] ✅ Rendered prompt template with variables")
        except KeyError as e:
            print(f"[EvaluationManager] ❌ Template variable error: {e}")
            # Fall back to raw template if variable substitution fails
            rendered_prompt = prompt_template
        
        # Mark end of prompt preparation, start of PURE Gemini API call
        user_timing['prompt_preparation_end'] = time.time()
        
        # PURE Gemini API timing starts here
        user_timing['gemini_api_start'] = time.time()
        user_timing['gemini_network_start'] = time.time()  # Network call starts
        
        # Use Gemini service for cleaning (ONLY the API call)
        cleaned_result = await self.gemini_service.clean_conversation_turn(
            raw_text=raw_turn.raw_text,
            speaker=raw_turn.speaker,
            cleaned_context=cleaned_context,
            cleaning_level=cleaning_level,
            model_params=model_params,
            rendered_prompt=rendered_prompt  # Use rendered template with variables
        )
        
        # PURE Gemini API timing ends here
        user_timing['gemini_network_end'] = time.time()  # Network call ends
        user_timing['gemini_api_end'] = time.time()
        
        # Response parsing starts
        user_timing['response_parsing_start'] = time.time()
        
        # Capture the actual function call data
        captured_call = self.gemini_service.get_latest_captured_call()
        print(f"[DEBUG] Captured call data: {captured_call}")
        
        # If the call failed, captured_call will be None
        if captured_call is None:
            print("[DEBUG] No captured call - likely API failure, creating fallback call data")
            captured_call = {
                'function_call': 'model.generate_content(prompt) # API call failed',
                'model_config': {
                    'model_name': 'gemini-2.5-flash-lite-preview-06-17',
                    'generation_config': {'temperature': 0.1, 'top_p': 0.8, 'top_k': 40},
                    'safety_settings': {}
                },
                'prompt': cleaned_result.get('prompt_used', 'No prompt available'),
                'response': 'API call failed - see fallback response',
                'timestamp': time.time(),
                'success': False
            }
        
        # Response parsing ends
        user_timing['response_parsing_end'] = time.time()
        
        # Calculate PURE Gemini network time
        gemini_pure_network_time = (user_timing['gemini_network_end'] - user_timing['gemini_network_start']) * 1000
        gemini_total_time = (user_timing['gemini_api_end'] - user_timing['gemini_api_start']) * 1000
        prompt_prep_time = (user_timing['prompt_preparation_end'] - user_timing['prompt_preparation_start']) * 1000
        response_parsing_time = (user_timing['response_parsing_end'] - user_timing['response_parsing_start']) * 1000
        
        # Log the Gemini interaction for transparency
        prompt_preview = cleaned_result.get('prompt_used', '')[:100] + '...' if cleaned_result.get('prompt_used') else 'No prompt'
        response_preview = cleaned_result.get('raw_response', '')[:100] + '...' if cleaned_result.get('raw_response') else 'No response'
        print(f"📤 PROMPT SENT: {prompt_preview}")
        print(f"📥 GEMINI RESPONSE: {response_preview}")
        print(f"\n⚡ TIMING BREAKDOWN:")
        print(f"   - Prompt Preparation: {prompt_prep_time:.2f}ms")
        print(f"   - PURE Gemini Network: {gemini_pure_network_time:.2f}ms 🎯")
        print(f"   - Response Parsing: {response_parsing_time:.2f}ms")
        print(f"   - Total Gemini Call: {gemini_total_time:.2f}ms")
        print(f"   - Confidence: {cleaned_result['metadata'].get('confidence_score', 'UNKNOWN')}")
        
        # Step: Database save timing
        user_timing['database_save_start'] = time.time()
        
        # Debug timing values
        print(f"[DEBUG] Timing values for calculation:")
        print(f"  database_query: {timing.get('database_query_end', 0)} - {timing.get('database_query_start', 0)}")
        print(f"  settings_preparation: {timing.get('settings_preparation_end', 0)} - {timing.get('settings_preparation_start', 0)}")
        print(f"  context_retrieval: {timing.get('context_retrieval_end', 0)} - {timing.get('context_retrieval_start', 0)}")
        print(f"  prompt_preparation: {user_timing.get('gemini_api_start', process_start)} - {user_timing.get('prompt_preparation_start', process_start)}")
        
        # Create comprehensive timing breakdown for user turns - include infrastructure + cleaning
        user_timing_breakdown = {
            # Infrastructure timing from main timing parameter
            'database_query_ms': self._safe_timing_diff('database_query_end', 'database_query_start', timing),
            'settings_preparation_ms': self._safe_timing_diff('settings_preparation_end', 'settings_preparation_start', timing),
            'context_retrieval_ms': self._safe_timing_diff('context_retrieval_end', 'context_retrieval_start', timing),
            'processing_decision_ms': self._safe_timing_diff('processing_decision_end', 'processing_decision_start', timing),
            
            # User turn specific timing (cleaning processing details)  
            'prompt_preparation_ms': self._safe_timing_diff('prompt_preparation_end', 'prompt_preparation_start', user_timing, process_start),
            'gemini_api_ms': self._safe_timing_diff('gemini_api_end', 'gemini_api_start', user_timing),
            'gemini_network_ms': self._safe_timing_diff('gemini_network_end', 'gemini_network_start', user_timing),  # PURE API time
            'response_parsing_ms': self._safe_timing_diff('response_parsing_end', 'response_parsing_start', user_timing),
            'database_save_ms': 0,  # Will be updated after db save
            'context_update_ms': 0,  # Will be updated after context update
            
            # Derived values for UI organization - calculate sum of cleaning components
            'cleaning_processing_ms': 0,  # Will be calculated after all components are measured
            'total_ms': 0  # Will be set to final processing time at the end
        }
        
        # Create cleaned turn record (timing will be updated later)
        temp_processing_time = (time.time() - process_start) * 1000
        cleaned_turn = CleanedTurn(
            evaluation_id=evaluation.id,
            turn_id=raw_turn.id,
            cleaned_text=cleaned_result['cleaned_text'],
            confidence_score=cleaned_result['metadata']['confidence_score'],
            cleaning_applied=str(cleaned_result['metadata']['cleaning_applied']),
            cleaning_level=cleaned_result['metadata']['cleaning_level'],
            processing_time_ms=temp_processing_time,
            corrections=cleaned_result['metadata']['corrections'],
            context_detected=cleaned_result['metadata']['context_detected'],
            ai_model_used=cleaned_result['metadata']['ai_model_used'],
            timing_breakdown=user_timing_breakdown,
            gemini_prompt=rendered_prompt,  # Store the rendered prompt with variables
            gemini_response=cleaned_result.get('raw_response'),
            gemini_http_request=captured_call,
            gemini_http_response=captured_call,
            template_variables=template_variables  # Store the variables used for rendering
        )
        
        db.add(cleaned_turn)
        db.commit()
        db.refresh(cleaned_turn)
        
        user_timing['database_save_end'] = time.time()
        
        # Step: Context update timing
        user_timing['context_update_start'] = time.time()
        
        # Add to evaluation history - will update with final timing later
        turn_data = {
            'evaluation_id': evaluation.id,
            'speaker': raw_turn.speaker,
            'raw_text': raw_turn.raw_text,
            'cleaned_text': cleaned_result['cleaned_text'],
            'confidence_score': cleaned_result['metadata']['confidence_score'],
            'cleaning_applied': cleaned_result['metadata']['cleaning_applied'],
            'cleaning_level': cleaned_result['metadata']['cleaning_level'],
            'processing_time_ms': 0,  # Will be updated with final timing
            'corrections': cleaned_result['metadata']['corrections'],
            'context_detected': cleaned_result['metadata']['context_detected'],
            'ai_model_used': cleaned_result['metadata']['ai_model_used']
        }
        
        evaluation_state.add_to_history(turn_data)
        
        user_timing['context_update_end'] = time.time()
        
        # Update the timing breakdown with final measurements
        user_timing_breakdown['database_save_ms'] = self._safe_timing_diff('database_save_end', 'database_save_start', user_timing)
        user_timing_breakdown['context_update_ms'] = self._safe_timing_diff('context_update_end', 'context_update_start', user_timing)
        
        # Calculate the total cleaning processing time (sum of all cleaning components)
        cleaning_components = [
            user_timing_breakdown['prompt_preparation_ms'],
            user_timing_breakdown['gemini_api_ms'], 
            user_timing_breakdown['database_save_ms'],
            user_timing_breakdown['context_update_ms']
        ]
        user_timing_breakdown['cleaning_processing_ms'] = round(sum(cleaning_components), 2)
        
        print(f"[DEBUG] Final timing breakdown:")
        for key, value in user_timing_breakdown.items():
            print(f"  {key}: {value}ms")
        
        # Calculate final processing time AFTER all operations
        final_processing_time_ms = (time.time() - process_start) * 1000
        
        # Update timing breakdown with the final total
        user_timing_breakdown['total_ms'] = round(final_processing_time_ms, 2)
        
        # Update the CleanedTurn record with final timing
        cleaned_turn.processing_time_ms = final_processing_time_ms
        cleaned_turn.timing_breakdown = user_timing_breakdown
        
        # Update the evaluation history data with final timing
        turn_data['processing_time_ms'] = final_processing_time_ms
        
        # Update evaluation turns count
        evaluation.turns_processed += 1
        db.commit()
        
        self.performance_metrics['user_processing_times'].append(final_processing_time_ms)
        self.performance_metrics['total_user_turns'] += 1
        
        print(f"\n✅ User turn processed in {final_processing_time_ms:.2f}ms")
        print(f"   🧠 Confidence: {cleaned_result['metadata']['confidence_score']} | Cleaning: {cleaned_result['metadata']['cleaning_applied']}")
        print(f"   ⏱️ Breakdown:")
        print(f"      - Prompt Prep: {user_timing_breakdown['prompt_preparation_ms']:.2f}ms")
        print(f"      - PURE Gemini: {user_timing_breakdown['gemini_network_ms']:.2f}ms 🎯")
        print(f"      - Response Parse: {user_timing_breakdown['response_parsing_ms']:.2f}ms")
        print(f"      - DB Save: {user_timing_breakdown['database_save_ms']:.2f}ms")
        
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
                'processing_time_ms': final_processing_time_ms,
                'corrections': cleaned_result['metadata']['corrections'],
                'context_detected': cleaned_result['metadata']['context_detected'],
                'ai_model_used': cleaned_result['metadata']['ai_model_used']
            },
            'created_at': cleaned_turn.created_at.isoformat(),
            'gemini_prompt': rendered_prompt,  # Include the rendered prompt with variables
            'gemini_response': cleaned_turn.gemini_response,
            'gemini_function_call': cleaned_turn.gemini_http_request,  # Contains the actual function call
            'debug_captured_call': captured_call,  # DEBUG: Show what was captured
            'gemini_raw_response': cleaned_turn.gemini_http_response,  # Contains the raw response
            'timing_breakdown': user_timing_breakdown,
            'template_variables': template_variables  # Include the variables used for rendering
        }
    
    def is_evaluation_stopped(self, evaluation_id: UUID) -> bool:
        """Check if an evaluation has been stopped"""
        return self.stopped_evaluations.get(evaluation_id, False)
    
    async def stop_evaluation(self, evaluation_id: UUID) -> Dict[str, Any]:
        """Stop an evaluation and its processing"""
        print(f"[EvaluationManager] Stopping evaluation {evaluation_id}")
        
        # Mark evaluation as stopped
        self.stopped_evaluations[evaluation_id] = True
        
        # Keep the evaluation state but mark it as stopped
        if evaluation_id in self.active_evaluations:
            print(f"[EvaluationManager] Evaluation {evaluation_id} marked as stopped (keeping processed data)")
        else:
            print(f"[EvaluationManager] Evaluation {evaluation_id} was not active")
        
        return {
            'success': True,
            'evaluation_id': str(evaluation_id),
            'message': 'Evaluation stopped successfully',
            'stopped_at': time.time()
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
    
    async def _save_user_variables_to_history(self, user_id: UUID, user_variables: Dict[str, str], db: Session):
        """Save user-provided variables to history for future suggestions"""
        if not user_variables:
            return
        
        print(f"[EvaluationManager] 💾 Saving user variables to history for user {user_id}")
        
        from datetime import datetime
        
        # User is authenticated via Supabase, so we can save variables directly
        
        for variable_name, variable_value in user_variables.items():
            # Only save if the variable has a value and is one we track
            if variable_value and variable_value.strip() and variable_name in ['call_context', 'additional_context']:
                try:
                    # Check if this exact combination already exists
                    existing = db.query(UserVariableHistory).filter(
                        UserVariableHistory.user_id == user_id,
                        UserVariableHistory.variable_name == variable_name,
                        UserVariableHistory.variable_value == variable_value.strip()
                    ).first()
                    
                    if existing:
                        # Update the used_at timestamp
                        existing.used_at = datetime.utcnow()
                        print(f"[EvaluationManager] ♻️ Updated existing variable: {variable_name}")
                    else:
                        # Create new entry
                        variable_history = UserVariableHistory(
                            user_id=user_id,
                            variable_name=variable_name,
                            variable_value=variable_value.strip()
                        )
                        db.add(variable_history)
                        print(f"[EvaluationManager] ✅ Saved new variable: {variable_name} = '{variable_value[:50]}...'")
                
                except Exception as e:
                    print(f"[EvaluationManager] ❌ Failed to save variable {variable_name}: {e}")
        
        try:
            db.commit()
            print(f"[EvaluationManager] 💾 User variables saved to database")
        except Exception as e:
            db.rollback()
            print(f"[EvaluationManager] ❌ Failed to commit user variables: {e}")