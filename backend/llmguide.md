# LLM Evaluation Pipeline - Complete Backend Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Database Models](#database-models)
4. [Evaluation Manager - The Core Engine](#evaluation-manager---the-core-engine)
5. [State Management](#state-management)
6. [Sliding Window Context](#sliding-window-context)
7. [Cleaner Service](#cleaner-service)
8. [Function Calling Pipeline](#function-calling-pipeline)
9. [Gemini Service Integration](#gemini-service-integration)
10. [API Endpoints](#api-endpoints)
11. [Complete Flow](#complete-flow)

## Overview

The evaluation pipeline is a sophisticated system for processing conversations with AI cleaning and function calling capabilities. It maintains stateful conversation context, implements sliding window processing, and provides real-time WebSocket updates.

### Key Features:
- **Stateful Processing**: Maintains conversation state across turns
- **Sliding Window Context**: Intelligent context management for LLM calls
- **Function Calling**: Dynamic function execution based on conversation context
- **Real-time Updates**: WebSocket integration for live UI updates
- **Performance Tracking**: Detailed timing breakdown for every operation

## Core Components

### 1. EvaluationState (In-Memory State Manager)
```python
class EvaluationState:
    """In-memory state for active evaluation processing"""
    def __init__(self, evaluation_id: UUID, conversation_id: UUID):
        self.evaluation_id = evaluation_id
        self.conversation_id = conversation_id
        self.cleaned_turns: List[Dict[str, Any]] = []
        self.function_call_history: List[Dict[str, Any]] = []
        self.mirrored_customer: MirroredCustomer = None
        self.prompt_template: PromptTemplate = None
        self.function_prompt_template: FunctionPromptTemplate = None
        self.function_prompt_template_id: UUID = None
        self.settings: Dict[str, Any] = {}
        self.created_at: datetime = datetime.utcnow()
        self.last_updated: datetime = datetime.utcnow()
```

### 2. Database Models

#### Evaluation Model
```python
class Evaluation(Base):
    __tablename__ = "evaluations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    prompt_template = Column(Text, nullable=True)  # Deprecated
    prompt_template_id = Column(UUID(as_uuid=True), ForeignKey("prompt_templates.id"), nullable=True)
    function_prompt_template_id = Column(UUID(as_uuid=True), ForeignKey("function_prompt_templates.id"), nullable=True)
    settings = Column(JSON, nullable=True)
    user_id = Column(String(100), nullable=False)
    status = Column(String(50), default="active", nullable=False)
    turns_processed = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="evaluations")
    cleaned_turns = relationship("CleanedTurn", back_populates="evaluation", cascade="all, delete-orphan")
    called_functions = relationship("CalledFunction", back_populates="evaluation", cascade="all, delete-orphan")
    prompt_template_ref = relationship("PromptTemplate")
    function_prompt_template_ref = relationship("FunctionPromptTemplate")
```

#### CleanedTurn Model
```python
class CleanedTurn(Base):
    __tablename__ = "cleaned_turns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    turn_id = Column(UUID(as_uuid=True), ForeignKey("turns.id"), nullable=False)
    cleaned_text = Column(Text, nullable=False)
    confidence_score = Column(String(10), nullable=False)  # HIGH, MEDIUM, LOW
    cleaning_applied = Column(String(10), nullable=False)  # true, false
    cleaning_level = Column(String(20), nullable=False)    # none, light, full
    processing_time_ms = Column(Float, nullable=False)
    corrections = Column(JSON, nullable=True)
    context_detected = Column(String(100), nullable=True)
    ai_model_used = Column(String(100), nullable=True)
    timing_breakdown = Column(JSON, nullable=True)
    gemini_prompt = Column(Text, nullable=True)
    gemini_response = Column(Text, nullable=True)
    gemini_http_request = Column(JSON, nullable=True)
    gemini_http_response = Column(JSON, nullable=True)
    template_variables = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="cleaned_turns")
    turn = relationship("Turn")
```

#### CalledFunction Model
```python
class CalledFunction(Base):
    __tablename__ = "called_functions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(UUID(as_uuid=True), ForeignKey("evaluations.id"), nullable=False)
    turn_id = Column(UUID(as_uuid=True), ForeignKey("turns.id"), nullable=False)
    function_name = Column(String(100), nullable=False)
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    executed = Column(Boolean, default=True, nullable=False)
    confidence_score = Column(String(10), nullable=True)  # HIGH, MEDIUM, LOW
    decision_reasoning = Column(Text, nullable=True)
    processing_time_ms = Column(Float, nullable=False)
    timing_breakdown = Column(JSON, nullable=True)
    function_template_id = Column(UUID(as_uuid=True), ForeignKey("function_prompt_templates.id"), nullable=True)
    gemini_prompt = Column(Text, nullable=True)
    gemini_response = Column(Text, nullable=True)
    gemini_http_request = Column(JSON, nullable=True)
    template_variables = Column(JSON, nullable=True)
    mock_data_before = Column(JSON, nullable=True)
    mock_data_after = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    evaluation = relationship("Evaluation", back_populates="called_functions")
    turn = relationship("Turn")
    function_template = relationship("FunctionPromptTemplate")
```

## Evaluation Manager - The Core Engine

### Initialization and State Management
```python
class EvaluationManager:
    def __init__(self, websocket_manager=None):
        self.gemini_service = GeminiService()
        self.function_executor = FunctionExecutor()
        self.prompt_service = PromptEngineeringService()
        self.websocket_manager = websocket_manager
        
        # In-memory state management
        self.active_evaluations: Dict[UUID, EvaluationState] = {}
        
        # Performance monitoring
        self.metrics: Dict[str, Any] = {
            'turns_processed': 0,
            'avg_processing_time': 0,
            'function_calls_made': 0,
            'errors_encountered': 0
        }
        
        # Initialize async executor for non-blocking DB operations
        self.db_executor = ThreadPoolExecutor(max_workers=5)
        
        logger.info("[EvaluationManager] Initialized with evaluation-based processing")
        logger.info("[EvaluationManager] Performance metrics tracking enabled")
        logger.info("[EvaluationManager] Prompt Engineering Service integrated")
        logger.info("[EvaluationManager] Async DB executor initialized")
```

### Create Evaluation with State
```python
async def create_evaluation(
    self,
    conversation_id: UUID,
    name: str,
    user_id: str,
    db: Session,
    description: str = None,
    prompt_template: str = None,
    prompt_template_id: UUID = None,
    function_prompt_template_id: UUID = None,
    settings: Dict[str, Any] = None
) -> Evaluation:
    """Create a new evaluation and initialize its state"""
    evaluation = Evaluation(
        conversation_id=conversation_id,
        name=name,
        description=description,
        prompt_template=prompt_template,
        prompt_template_id=prompt_template_id,
        function_prompt_template_id=function_prompt_template_id,
        settings=settings or {},
        user_id=user_id,
        status="active",
        turns_processed=0
    )
    
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    
    # Initialize in-memory state
    state = EvaluationState(evaluation.id, conversation_id)
    state.settings = settings or {}
    
    # Load prompt templates if specified
    if prompt_template_id:
        template = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_template_id).first()
        if template:
            state.prompt_template = template
    
    if function_prompt_template_id:
        func_template = db.query(FunctionPromptTemplate).filter(
            FunctionPromptTemplate.id == function_prompt_template_id
        ).first()
        if func_template:
            state.function_prompt_template = func_template
            state.function_prompt_template_id = function_prompt_template_id
    
    self.active_evaluations[evaluation.id] = state
    
    return evaluation
```

## State Management

### Getting and Managing Evaluation State
```python
def _get_evaluation_state(self, evaluation_id: UUID) -> Optional[EvaluationState]:
    """Get evaluation state from memory"""
    return self.active_evaluations.get(evaluation_id)

def _ensure_evaluation_state(self, evaluation: Evaluation, db: Session) -> EvaluationState:
    """Ensure evaluation state exists in memory"""
    if evaluation.id not in self.active_evaluations:
        # Reconstruct state from database
        state = EvaluationState(evaluation.id, evaluation.conversation_id)
        state.settings = evaluation.settings or {}
        
        # Load cleaned turns
        cleaned_turns = db.query(CleanedTurn).filter(
            CleanedTurn.evaluation_id == evaluation.id
        ).order_by(CleanedTurn.created_at.asc()).all()
        
        for ct in cleaned_turns:
            state.cleaned_turns.append({
                'turn_id': str(ct.turn_id),
                'speaker': ct.turn.speaker,
                'cleaned_text': ct.cleaned_text,
                'metadata': {
                    'confidence_score': ct.confidence_score,
                    'cleaning_applied': ct.cleaning_applied == "true",
                    'cleaning_level': ct.cleaning_level,
                    'processing_time_ms': ct.processing_time_ms
                }
            })
        
        # Load function call history
        function_calls = db.query(CalledFunction).filter(
            CalledFunction.evaluation_id == evaluation.id
        ).order_by(CalledFunction.created_at.asc()).all()
        
        for fc in function_calls:
            state.function_call_history.append({
                'turn_id': str(fc.turn_id),
                'function_name': fc.function_name,
                'parameters': fc.parameters,
                'result': fc.result,
                'success': fc.executed
            })
        
        # Restore mirrored customer if exists
        if state.function_call_history:
            state.mirrored_customer = self.function_executor.restore_customer_state(
                evaluation_id=evaluation.id,
                db=db
            )
        
        self.active_evaluations[evaluation.id] = state
    
    return self.active_evaluations[evaluation.id]
```

## Sliding Window Context

### Building Cleaned Context for Cleaner
```python
def _build_cleaned_context(self, evaluation_state: EvaluationState, max_turns: int = 10) -> List[Dict[str, Any]]:
    """Build cleaned conversation context using sliding window"""
    # Take the last N turns for context
    context_turns = evaluation_state.cleaned_turns[-max_turns:] if evaluation_state.cleaned_turns else []
    
    # Format for cleaner service
    return [
        {
            'speaker': turn['speaker'],
            'cleaned_text': turn['cleaned_text']
        }
        for turn in context_turns
    ]
```

### Building Function Calling Context
```python
def _build_function_context(
    self, 
    evaluation_state: EvaluationState, 
    cleaned_result: Dict[str, Any],
    max_conversation_turns: int = 20,
    max_function_calls: int = 10
) -> Dict[str, Any]:
    """Build comprehensive context for function calling decisions with sliding window"""
    
    # Include current cleaned turn in the conversation history
    all_turns = evaluation_state.cleaned_turns + [{
        'speaker': cleaned_result['speaker'],
        'cleaned_text': cleaned_result['cleaned_text'],
        'turn_id': cleaned_result['turn_id']
    }]
    
    # Apply sliding window to conversation
    recent_turns = all_turns[-max_conversation_turns:]
    
    # Get recent function calls with sliding window
    recent_function_calls = evaluation_state.function_call_history[-max_function_calls:]
    
    # Build the call context (most recent user request)
    call_context = {
        'user_request': cleaned_result['cleaned_text'],
        'speaker': cleaned_result['speaker'],
        'turn_sequence': cleaned_result['turn_sequence']
    }
    
    # Format cleaned conversation for the prompt
    cleaned_conversation = []
    for turn in recent_turns:
        cleaned_conversation.append({
            'speaker': turn['speaker'],
            'text': turn['cleaned_text']
        })
    
    # Get available functions
    available_functions = self.function_executor.get_available_functions()
    
    # Format previous function calls
    previous_function_calls = []
    for fc in recent_function_calls:
        previous_function_calls.append({
            'function': fc['function_name'],
            'parameters': fc['parameters'],
            'result': fc.get('result', 'No result'),
            'success': fc.get('success', False)
        })
    
    return {
        'call_context': call_context,
        'cleaned_conversation': cleaned_conversation,
        'available_functions': available_functions,
        'previous_function_calls': previous_function_calls,
        'mirrored_customer': evaluation_state.mirrored_customer
    }
```

## Cleaner Service

### Processing a Turn with Cleaner
```python
async def _process_cleaner(
    self, 
    raw_turn, 
    evaluation_state: EvaluationState,
    settings: Dict[str, Any],
    timing: Dict[str, float]
) -> Dict[str, Any]:
    """Process turn through cleaner with context"""
    timing['cleaner_start'] = time.time()
    
    # Build cleaned context for the cleaner
    cleaned_context = self._build_cleaned_context(evaluation_state)
    
    # Get cleaning level from settings
    cleaning_level = settings.get('cleaning_level', 'full')
    model_params = settings.get('model_params', {})
    
    # Check if we should use a custom prompt template
    rendered_prompt = None
    template_variables = None
    
    if evaluation_state.prompt_template:
        # Build template variables
        template_variables = {
            'raw_text': raw_turn.raw_text,
            'speaker': raw_turn.speaker,
            'cleaned_context': '\n'.join([
                f"{turn['speaker']}: {turn['cleaned_text']}" 
                for turn in cleaned_context[-5:]  # Last 5 turns for template
            ]),
            'cleaning_level': cleaning_level
        }
        
        # Render the prompt template
        rendered_prompt = evaluation_state.prompt_template.template.format(**template_variables)
    
    # Clean the turn using Gemini
    cleaned_response = await self.gemini_service.clean_conversation_turn(
        raw_text=raw_turn.raw_text,
        speaker=raw_turn.speaker,
        cleaned_context=cleaned_context,
        cleaning_level=cleaning_level,
        model_params=model_params,
        rendered_prompt=rendered_prompt
    )
    
    timing['cleaner_end'] = time.time()
    
    # Add template variables to response if used
    if template_variables:
        cleaned_response['template_variables'] = template_variables
    
    # Update state with cleaned turn
    evaluation_state.cleaned_turns.append({
        'turn_id': str(raw_turn.id),
        'speaker': raw_turn.speaker,
        'cleaned_text': cleaned_response['cleaned_text'],
        'metadata': cleaned_response['metadata']
    })
    evaluation_state.last_updated = datetime.utcnow()
    
    return cleaned_response
```

## Function Calling Pipeline

### Complete Function Processing Flow
```python
async def _process_function_calls(
    self,
    raw_turn,
    evaluation_state: EvaluationState,
    cleaned_result: Dict[str, Any],
    db: Session,
    timing: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Process function calls for a turn with full context"""
    function_timing = timing or {}
    function_decision_captured_call = None  # Initialize to ensure it's available
    
    # Skip function calling for AI/system turns
    if raw_turn.speaker in ['Lumen', 'AI', 'System']:
        return {
            'functions': [],
            'decision': None,
            'function_decision_gemini_call': None
        }
    
    # Ensure mirrored customer exists
    if not evaluation_state.mirrored_customer:
        evaluation_state.mirrored_customer = await self.function_executor.create_mirrored_customer(
            conversation_id=evaluation_state.conversation_id,
            evaluation_id=evaluation_state.evaluation_id,
            db=db
        )
    
    function_timing['function_context_start'] = time.time()
    
    # Build comprehensive context for function decision
    context = self._build_function_context(evaluation_state, cleaned_result)
    
    function_timing['function_context_end'] = time.time()
    function_timing['function_prompt_start'] = time.time()
    
    # Build the function decision prompt
    template_variables = {
        'call_context': context['call_context'],
        'cleaned_conversation': context['cleaned_conversation'],
        'available_functions': context['available_functions'],
        'previous_function_calls': context['previous_function_calls']
    }
    
    rendered_prompt = evaluation_state.function_prompt_template.format(**template_variables)
    
    function_timing['function_prompt_end'] = time.time()
    function_timing['function_gemini_start'] = time.time()
    
    # Get function decision from Gemini
    response = await self.gemini_service.clean_conversation_turn(
        raw_text=rendered_prompt,
        speaker="System",
        cleaned_context=[],
        cleaning_level="none",
        model_params={'temperature': 0.1, 'model_name': 'gemini-2.5-flash-lite-preview-06-17'}
    )
    
    function_timing['function_gemini_end'] = time.time()
    
    # Capture the actual function decision Gemini call
    function_decision_captured_call = self.gemini_service.get_latest_captured_call()
    
    response_text = response.get('cleaned_text', '').strip()
    
    function_timing['function_parse_start'] = time.time()
    
    # Parse the function decision
    try:
        decision = json.loads(response_text)
    except json.JSONDecodeError as e:
        # Handle parse error...
        pass
    
    function_timing['function_parse_end'] = time.time()
    function_timing['function_execute_start'] = time.time()
    
    # Execute functions if any
    executed_functions = []
    function_calls = decision.get('function_calls', [])
    
    if function_calls:
        for func_call in function_calls:
            result = await self._execute_single_function(
                func_call, evaluation_state, cleaned_result, raw_turn, db, 
                thought_process=decision.get('thought_process'),
                function_decision_captured_call=function_decision_captured_call,
                template_variables=template_variables,
                function_timing=function_timing
            )
            executed_functions.append(result)
            
            # Update function call history
            evaluation_state.function_call_history.append({
                'turn_id': str(raw_turn.id),
                'turn_sequence': raw_turn.turn_sequence,
                'function_name': func_call['name'],
                'parameters': func_call['parameters'],
                'result': result.get('result'),
                'success': result.get('success', False),
                'execution_time_ms': result.get('execution_time_ms', 0)
            })
    
    function_timing['function_execute_end'] = time.time()
    
    return {
        'functions': executed_functions,
        'decision': {
            'thought_process': decision.get('thought_process'),
            'confidence_level': decision.get('confidence_level'),
            'function_calls': function_calls,
            'total_execution_time_ms': sum(f.get('execution_time_ms', 0) for f in executed_functions),
            'functions_executed': len(executed_functions),
            'functions_succeeded': len([f for f in executed_functions if f.get('success')]),
            'functions_failed': len([f for f in executed_functions if not f.get('success')])
        },
        'function_decision_gemini_call': function_decision_captured_call
    }
```

### Single Function Execution
```python
async def _execute_single_function(
    self,
    func_call: Dict[str, Any],
    evaluation_state: EvaluationState,
    cleaned_result: Dict[str, Any],
    raw_turn,
    db: Session,
    thought_process: str = None,
    function_decision_captured_call: Dict[str, Any] = None,
    template_variables: Dict[str, Any] = None,
    function_timing: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Execute a single function and create database record"""
    
    function_name = func_call['name']
    parameters = func_call['parameters']
    
    try:
        # Execute function using function executor
        execution_result = await self.function_executor.execute_function(
            function_name=function_name,
            parameters=parameters,
            mirrored_customer=evaluation_state.mirrored_customer,
            db=db
        )
        
        # Add function decision data to execution result before saving
        if function_decision_captured_call:
            execution_result['function_decision_prompt'] = function_decision_captured_call.get('prompt')
            execution_result['function_decision_response'] = function_decision_captured_call.get('response')
            execution_result['function_decision_gemini_call'] = function_decision_captured_call
        
        # Add template variables and timing data
        if template_variables:
            execution_result['template_variables'] = template_variables
        if function_timing:
            execution_result['timing_breakdown'] = function_timing
        
        # Add function template ID if available
        if hasattr(evaluation_state, 'function_prompt_template_id'):
            execution_result['function_template_id'] = evaluation_state.function_prompt_template_id
        
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
            'result': execution_result.get('result'),
            'success': execution_result.get('success', False),
            'execution_time_ms': execution_result.get('execution_time_ms', 0),
            'error': None,
            'confidence_score': 'MEDIUM',
            'decision_reasoning': thought_process,
            'timing_breakdown': None,
            'mock_data_before': execution_result.get('before_state'),
            'mock_data_after': execution_result.get('after_state'),
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
            'changes_made': execution_result.get('changes_made', [])
        }
        
    except Exception as e:
        # Error handling...
        pass
```

### Async Database Save
```python
def _save_function_call_async(
    self,
    evaluation_id: UUID,
    turn_id: UUID,
    function_name: str,
    parameters: Dict[str, Any],
    execution_result: Dict[str, Any],
    db: Session,
    thought_process: str = None
):
    """Save function call to database asynchronously with separate session"""
    def _save_function_call():
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
                confidence_score='MEDIUM',
                decision_reasoning=thought_process,
                processing_time_ms=execution_result.get('execution_time_ms', 0),
                mock_data_before=execution_result.get('before_state'),
                mock_data_after=execution_result.get('after_state'),
                gemini_prompt=execution_result.get('function_decision_prompt'),
                gemini_response=execution_result.get('function_decision_response'),
                gemini_http_request=execution_result.get('function_decision_gemini_call'),
                template_variables=execution_result.get('template_variables'),
                timing_breakdown=execution_result.get('timing_breakdown'),
                function_template_id=execution_result.get('function_template_id')
            )
            
            new_db.add(called_function)
            new_db.commit()
            
        except Exception as e:
            new_db.rollback()
        finally:
            new_db.close()
    
    # Submit to thread pool for async execution
    self.db_executor.submit(_save_function_call)
```

## Complete Turn Processing

### Main Process Turn Method
```python
async def process_turn(
    self,
    evaluation_id: UUID,
    turn_id: UUID,
    db: Session,
    override_settings: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Process a single turn in an evaluation"""
    timing = {
        'start': time.time()
    }
    
    # Get evaluation and ensure state exists
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        raise ValueError(f"Evaluation {evaluation_id} not found")
    
    evaluation_state = self._ensure_evaluation_state(evaluation, db)
    
    # Get the raw turn
    raw_turn = db.query(Turn).filter(Turn.id == turn_id).first()
    if not raw_turn:
        raise ValueError(f"Turn {turn_id} not found")
    
    # Check if turn already processed
    existing = db.query(CleanedTurn).filter(
        CleanedTurn.evaluation_id == evaluation_id,
        CleanedTurn.turn_id == turn_id
    ).first()
    
    if existing:
        # Return existing result
        return self._format_turn_result(existing, evaluation_state, db)
    
    # Merge settings
    settings = {**(evaluation.settings or {}), **(override_settings or {})}
    
    timing['initialization_end'] = time.time()
    
    # Process through cleaner
    cleaned_result = await self._process_cleaner(
        raw_turn, evaluation_state, settings, timing
    )
    
    # Save cleaned turn to database
    cleaned_turn = CleanedTurn(
        evaluation_id=evaluation_id,
        turn_id=turn_id,
        cleaned_text=cleaned_result['cleaned_text'],
        confidence_score=cleaned_result['metadata']['confidence_score'],
        cleaning_applied=str(cleaned_result['metadata']['cleaning_applied']).lower(),
        cleaning_level=cleaned_result['metadata']['cleaning_level'],
        processing_time_ms=cleaned_result['metadata']['processing_time_ms'],
        corrections=cleaned_result['metadata'].get('corrections', []),
        context_detected=cleaned_result['metadata'].get('context_detected'),
        ai_model_used=cleaned_result['metadata'].get('ai_model_used'),
        gemini_prompt=cleaned_result.get('prompt_used'),
        gemini_response=cleaned_result.get('raw_response'),
        template_variables=cleaned_result.get('template_variables'),
        timing_breakdown=timing
    )
    
    db.add(cleaned_turn)
    db.commit()
    
    # Update evaluation turns processed count
    evaluation.turns_processed += 1
    db.commit()
    
    # Process function calls if enabled
    function_call_data = None
    if settings.get('enable_function_calling', True) and raw_turn.speaker not in ['Lumen', 'AI']:
        function_call_data = await self._process_function_calls(
            raw_turn, evaluation_state, cleaned_result, db, timing
        )
    
    timing['end'] = time.time()
    timing['total_ms'] = round((timing['end'] - timing['start']) * 1000, 2)
    
    # Send WebSocket update
    if self.websocket_manager:
        await self.websocket_manager.send_evaluation_update(
            evaluation_id=str(evaluation_id),
            update_type="turn_processed",
            data={
                'turn_id': str(turn_id),
                'cleaned_text': cleaned_result['cleaned_text'],
                'processing_time_ms': timing['total_ms']
            }
        )
    
    # Format and return result
    result = {
        'cleaned_turn_id': str(cleaned_turn.id),
        'evaluation_id': str(evaluation_id),
        'turn_id': str(turn_id),
        'cleaned_text': cleaned_result['cleaned_text'],
        'metadata': cleaned_result['metadata'],
        'created_at': cleaned_turn.created_at.isoformat(),
        'speaker': raw_turn.speaker,
        'raw_text': raw_turn.raw_text,
        'turn_sequence': raw_turn.turn_sequence,
        'gemini_prompt': cleaned_result.get('prompt_used'),
        'gemini_response': cleaned_result.get('raw_response'),
        'template_variables': cleaned_result.get('template_variables'),
        'timing_breakdown': timing
    }
    
    # Add function calls and decision metadata
    if function_call_data:
        result['function_calls'] = function_call_data.get('functions', [])
        result['function_decision'] = function_call_data.get('decision')
        result['function_decision_gemini_call'] = function_call_data.get('function_decision_gemini_call')
    else:
        result['function_calls'] = []
        result['function_decision'] = None
        result['function_decision_gemini_call'] = None
    
    return result
```

## Gemini Service Integration

### Clean Conversation Turn with Capture
```python
async def clean_conversation_turn(
    self, 
    raw_text: str, 
    speaker: str,
    cleaned_context: List[Dict[str, Any]],
    cleaning_level: str = "full",
    model_params: Dict[str, Any] = None,
    rendered_prompt: str = None
) -> Dict[str, Any]:
    """Clean a single conversation turn using CleanerContext methodology"""
    start_time = time.time()
    
    # Skip processing for Lumen turns (they're already perfect)
    if speaker == "Lumen" or speaker == "AI":
        return {
            "cleaned_text": raw_text,
            "metadata": {
                "confidence_score": "HIGH",
                "cleaning_applied": False,
                "cleaning_level": "none",
                "corrections": [],
                "context_detected": "ai_response",
                "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                "ai_model_used": "bypass"
            }
        }
    
    # Use rendered prompt if provided, otherwise build default
    if rendered_prompt:
        prompt = rendered_prompt
    else:
        prompt = self._build_cleaning_prompt(raw_text, cleaned_context, cleaning_level)
    
    try:
        # Call Gemini with timeout and capture
        response = await self._call_gemini_with_timeout(
            self.model if not model_params else self._create_custom_model(model_params),
            prompt,
            timeout_seconds=3,
            model_config=model_params
        )
        
        # Process response...
        cleaned_text = response.text.strip()
        
        cleaned_response = {
            "cleaned_text": cleaned_text,
            "metadata": {
                "confidence_score": "MEDIUM",
                "cleaning_applied": raw_text.strip() != cleaned_text.strip(),
                "cleaning_level": cleaning_level,
                "corrections": [],
                "context_detected": "business_conversation",
                "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                "ai_model_used": model_params.get("model_name", self.model_name) if model_params else self.model_name
            },
            "raw_response": response.text,
            "prompt_used": prompt
        }
        
        return cleaned_response
        
    except Exception as e:
        return self._fallback_response(raw_text, start_time, "api_error")
```

### Gemini Call with Capture
```python
async def _call_gemini_with_timeout(self, model, prompt: str, timeout_seconds: int = 3, model_config: Dict[str, Any] = None):
    """Call Gemini API with timeout and capture actual function call"""
    try:
        loop = asyncio.get_event_loop()
        
        def _sync_call():
            return model.generate_content(prompt)
        
        # Run with timeout
        response = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_call),
            timeout=timeout_seconds
        )
        
        # Capture the actual function call that was made
        actual_call = {
            'function_call': f'model.generate_content(prompt)',
            'model_config': model_config or {
                'model_name': self.model_name,
                'generation_config': self.generation_config,
                'safety_settings': {k.name: v.name for k, v in self.safety_settings.items()}
            },
            'prompt': prompt,
            'response': response.text,
            'timestamp': time.time(),
            'success': True
        }
        
        # Store the actual call for this turn
        self.captured_code_examples.append(actual_call)
        
        return response
        
    except asyncio.TimeoutError:
        raise
    except Exception as e:
        raise
```

## API Endpoints

### Process Turn Endpoint
```python
@router.post(
    "/{evaluation_id}/process-turn",
    response_model=CleanedTurnResponse,
    summary="Process a single turn in an evaluation"
)
async def process_turn(
    evaluation_id: str,
    request: ProcessTurnRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Process a single turn through the evaluation pipeline"""
    try:
        evaluation_uuid = UUID(evaluation_id)
        turn_uuid = UUID(request.turn_id)
        
        # Process the turn
        result = await evaluation_manager.process_turn(
            evaluation_id=evaluation_uuid,
            turn_id=turn_uuid,
            db=db,
            override_settings=request.settings
        )
        
        # Format function calls and decision
        formatted_function_calls = result.get('function_calls', [])
        function_decision = result.get('function_decision')
        
        return CleanedTurnResponse(
            id=result['cleaned_turn_id'],
            evaluation_id=result['evaluation_id'],
            turn_id=result['turn_id'],
            cleaned_text=result['cleaned_text'],
            confidence_score=result['metadata']['confidence_score'],
            cleaning_applied=result['metadata']['cleaning_applied'],
            cleaning_level=result['metadata']['cleaning_level'],
            processing_time_ms=result['metadata']['processing_time_ms'],
            corrections=result['metadata']['corrections'],
            context_detected=result['metadata']['context_detected'],
            ai_model_used=result['metadata']['ai_model_used'],
            created_at=result['created_at'],
            raw_speaker=result['speaker'],
            raw_text=result['raw_text'],
            turn_sequence=result['turn_sequence'],
            gemini_prompt=result.get('gemini_prompt'),
            gemini_response=result.get('gemini_response'),
            gemini_function_call=result.get('gemini_function_call'),
            template_variables=result.get('template_variables'),
            timing_breakdown=result.get('timing_breakdown'),
            function_calls=formatted_function_calls,
            function_decision=function_decision,
            function_decision_gemini_call=result.get('function_decision_gemini_call')
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Get Evaluation Details Endpoint
```python
@router.get(
    "/{evaluation_id}",
    response_model=EvaluationDetailsResponse,
    summary="Get evaluation details with all cleaned turns"
)
async def get_evaluation_details(
    evaluation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get complete evaluation details including all cleaned turns and function calls"""
    evaluation_uuid = UUID(evaluation_id)
    
    # Get evaluation
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_uuid,
        Evaluation.user_id == current_user['email']
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Get all cleaned turns with relationships
    cleaned_turns = db.query(CleanedTurn).filter(
        CleanedTurn.evaluation_id == evaluation_uuid
    ).join(Turn).order_by(Turn.turn_sequence.asc()).all()
    
    # Get function calls for this evaluation
    function_calls = db.query(CalledFunction).filter(
        CalledFunction.evaluation_id == evaluation_uuid
    ).order_by(CalledFunction.created_at.asc()).all()
    
    # Group function calls by turn_id
    function_calls_by_turn = {}
    for fc in function_calls:
        turn_id = str(fc.turn_id)
        if turn_id not in function_calls_by_turn:
            function_calls_by_turn[turn_id] = []
        
        function_calls_by_turn[turn_id].append({
            'function_name': fc.function_name,
            'parameters': fc.parameters,
            'result': fc.result,
            'success': fc.executed,
            'execution_time_ms': fc.processing_time_ms,
            'confidence_score': fc.confidence_score,
            'decision_reasoning': fc.decision_reasoning,
            'timing_breakdown': fc.timing_breakdown,
            'created_at': fc.created_at.isoformat()
        })
    
    # Build cleaned turn responses
    cleaned_turn_responses = []
    for ct in cleaned_turns:
        turn_id = str(ct.turn_id)
        turn_function_calls = function_calls_by_turn.get(turn_id, [])
        
        # Create function decision metadata if function calls exist
        function_decision = None
        function_decision_gemini_call = None
        if turn_function_calls:
            total_execution_time = sum(fc.get('execution_time_ms', 0) for fc in turn_function_calls)
            
            function_decision = {
                'thought_process': turn_function_calls[0].get('decision_reasoning'),
                'confidence_score': turn_function_calls[0].get('confidence_score'),
                'total_execution_time_ms': total_execution_time,
                'functions_called': len(turn_function_calls)
            }
            
            # Get function decision Gemini call from the first function call
            first_function_call = next((fc_obj for fc_obj in function_calls if str(fc_obj.turn_id) == turn_id), None)
            if first_function_call and first_function_call.gemini_http_request:
                function_decision_gemini_call = first_function_call.gemini_http_request
        
        cleaned_turn_responses.append(CleanedTurnResponse(
            id=str(ct.id),
            evaluation_id=str(ct.evaluation_id),
            turn_id=str(ct.turn_id),
            cleaned_text=ct.cleaned_text,
            confidence_score=ct.confidence_score,
            cleaning_applied=ct.cleaning_applied == "true",
            cleaning_level=ct.cleaning_level,
            processing_time_ms=ct.processing_time_ms,
            corrections=ct.corrections or [],
            context_detected=ct.context_detected,
            ai_model_used=ct.ai_model_used,
            created_at=ct.created_at.isoformat(),
            raw_speaker=ct.turn.speaker,
            raw_text=ct.turn.raw_text,
            turn_sequence=ct.turn.turn_sequence,
            gemini_prompt=ct.gemini_prompt,
            gemini_response=ct.gemini_response,
            template_variables=ct.template_variables,
            timing_breakdown=ct.timing_breakdown,
            function_calls=turn_function_calls,
            function_decision=function_decision,
            function_decision_gemini_call=function_decision_gemini_call
        ))
    
    return EvaluationDetailsResponse(
        evaluation=EvaluationResponse(...),
        cleaned_turns=cleaned_turn_responses,
        conversation_name=conversation.name if conversation else "Unknown",
        total_raw_turns=total_turns
    )
```

## Complete Flow

### End-to-End Turn Processing Flow

1. **API Request**: Client sends process turn request
2. **State Management**: Evaluation state is loaded/created from database
3. **Sliding Window Context**: Last N turns are loaded for context
4. **Cleaner Processing**: 
   - Build context from state
   - Apply prompt template if configured
   - Call Gemini with timeout
   - Capture HTTP request/response
5. **State Update**: Cleaned turn added to in-memory state
6. **Function Calling** (if enabled):
   - Build function context with sliding window
   - Generate function decision prompt
   - Call Gemini for decision
   - Parse and execute functions
   - Update mirrored customer state
   - Save function calls async
7. **Database Persistence**: 
   - Save cleaned turn
   - Queue function calls for async save
   - Update evaluation metadata
8. **WebSocket Update**: Send real-time update to connected clients
9. **Response**: Return complete turn data with all metadata

### Key Performance Optimizations

1. **Async Database Operations**: Function calls saved in background threads
2. **Sliding Window**: Limits context size for LLM calls
3. **State Caching**: In-memory state reduces database queries
4. **Parallel Processing**: Multiple turns can be processed concurrently
5. **Connection Pooling**: Efficient database connection management
6. **Timeout Protection**: 3-second timeout on all Gemini calls

### Error Handling and Recovery

1. **State Recovery**: Can rebuild state from database if lost
2. **Fallback Responses**: Returns original text if cleaning fails
3. **Transaction Safety**: Database operations are atomic
4. **Graceful Degradation**: Function calling failures don't stop processing
5. **Detailed Error Tracking**: All errors logged with full context

## Summary

This evaluation pipeline provides a robust, scalable system for processing conversations with:
- Stateful context management using sliding windows
- Intelligent AI-powered text cleaning
- Dynamic function calling based on conversation context
- Real-time updates via WebSocket
- Comprehensive performance tracking
- Fault-tolerant design with graceful error handling

The system maintains conversation state across turns, uses sliding windows to manage context efficiently, and provides detailed insights into every processing step through comprehensive timing and metadata capture.