"""
ProductionProcessor - Real-time conversation processing for live voice AI integration

This is the production-ready version of our evaluation system, optimized for real-time
processing with your colleague's voice AI system. No evaluation overhead - just core
conversation cleaning and function calling.
"""

import time
import logging
import asyncio
from typing import Dict, List, Optional, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

from app.services.gemini_service import GeminiService
from app.services.function_executor import FunctionExecutor
from app.services.function_registry import function_registry

logger = logging.getLogger(__name__)

@dataclass
class ConversationTurn:
    """Represents a single turn in the conversation"""
    speaker: str  # "User" or "Lumen"
    raw_text: str
    cleaned_text: Optional[str] = None
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

@dataclass
class FunctionCallResult:
    """Result of a function call"""
    function_name: str
    parameters: Dict[str, Any]
    result: Any
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

class ConversationSession:
    """Manages state for a single live conversation session"""
    
    def __init__(self, session_id: UUID, window_size: int = 10):
        self.session_id = session_id
        self.window_size = window_size
        self.conversation_history: List[ConversationTurn] = []
        self.function_call_history: List[FunctionCallResult] = []
        self.customer_profile: Dict[str, Any] = {}
        self.created_at = time.time()
        self.last_activity = time.time()
        
        logger.info(f"[Session {session_id}] Created new conversation session")
    
    def add_turn(self, speaker: str, raw_text: str) -> ConversationTurn:
        """Add a new turn to the conversation"""
        turn = ConversationTurn(speaker=speaker, raw_text=raw_text)
        self.conversation_history.append(turn)
        self.last_activity = time.time()
        
        logger.info(f"[Session {self.session_id}] Added {speaker} turn: {raw_text[:50]}...")
        return turn
    
    def update_turn_cleaned_text(self, turn: ConversationTurn, cleaned_text: str):
        """Update the cleaned text for a turn"""
        turn.cleaned_text = cleaned_text
        logger.info(f"[Session {self.session_id}] Updated cleaned text: {cleaned_text[:50]}...")
    
    def add_function_call(self, function_name: str, parameters: Dict, result: Any):
        """Record a function call"""
        call_result = FunctionCallResult(
            function_name=function_name,
            parameters=parameters,
            result=result
        )
        self.function_call_history.append(call_result)
        logger.info(f"[Session {self.session_id}] Function called: {function_name}")
    
    def get_context_window(self) -> List[ConversationTurn]:
        """Get recent conversation history for context"""
        return self.conversation_history[-self.window_size:]
    
    def get_cleaned_context(self) -> str:
        """Get cleaned conversation history as formatted string"""
        context_turns = self.get_context_window()
        context_lines = []
        
        for turn in context_turns:
            if turn.cleaned_text:
                context_lines.append(f"{turn.speaker}: {turn.cleaned_text}")
        
        return "\n".join(context_lines)

class ProductionProcessor:
    """
    Production-ready real-time conversation processor
    
    This class handles:
    1. Real-time turn processing as they come from voice AI
    2. Text cleaning using hardcoded best prompt
    3. Function calling based on cleaned text
    4. UI notifications via callbacks
    5. Memory management for ongoing conversations
    """
    
    # Hardcoded best prompts (will be updated with your final versions)
    CLEANER_PROMPT = """You are an expert STT Correction Specialist. Your role is to process raw speech-to-text output from a live business conversation and return a clean, accurate version that reflects precisely what the speaker intended to say.

YOUR CORE PHILOSOPHY:
Preserve the speaker's authentic voice. Your job is to surgically remove transcription errors—the "static" from the STT system—not to rewrite or "improve" the speaker's natural style.

CARDINAL RULE:
NEVER INVENT SPECIFIC FACTS. This is your most important rule. You must not invent or hallucinate specific numbers, metrics, or proper nouns. If the raw text contains a garbled number-like sound (e.g., "figh percent convert"), you MUST transcribe it phonetically or omit the garbled word. You must NOT guess a number (e.g., turning it into "5 percent convert").

HIERARCHY OF INFORMATION:
When making decisions, you must adhere to this hierarchy of trust:
1.  `CALL CONTEXT` is GROUND TRUTH. The names, terms, and business details here are 100% correct and MUST be used to resolve ambiguity.
2.  `CONVERSATION HISTORY` is RELIABLE. It has already been cleaned.
3.  `RAW TEXT` is UNRELIABLE. It is the subject that requires correction.

PRIMARY DIRECTIVES:
1.  Actively Cross-Reference Ground Truth: Before finalizing any correction, you MUST check if a potentially garbled word in the `RAW TEXT` corresponds to a term, name, or concept in the `CALL CONTEXT`. If a plausible match exists (e.g., "legion" sounds like "lead generation"), the `CALL_CONTEXT` term MUST be prioritized.
2.  Correct Only What Is Broken: Fix obvious STT mistakes. Do not alter informal grammar or fragmented thoughts that are part of a natural speaking style.
3.  Finalize the Speaker's Thought: Condense stutters, repetitions, and self-corrections into the user's final, intended statement without changing their wording.
4.  Perform Justified Semantic Inference: You are encouraged to make intelligent leaps to fix nonsensical phrases, but your correction must pass the "Anchor Test". The Anchor Test:
    *   Is your proposed correction a common English phrase/idiom directly supported by the conversation's logical flow? (e.g., adding "a pain" to "...in real life").
    *   OR, does your correction use a specific term from the `CALL CONTEXT` to fix a phonetic error? (e.g., `coast` -> `calls`).
    *   If a correction fails this test, it is an unacceptable guess. Revert to a more minimal fix.
5.  When in Doubt, Be Conservative: If you cannot find a strong Contextual Anchor for a creative leap, do not guess. Perform the most minimal correction possible.

[START CALL CONTEXT]
{call_context}
[END CALL CONTEXT]

[START CONVERSATION HISTORY]
{conversation_context}
[END CONVERSATION HISTORY]

[START RAW TEXT TO CORRECT]
{raw_text}
[END RAW TEXT TO CORRECT]

Based on all provided inputs, clean the text located in the `RAW TEXT TO CORRECT` block. Your output must be a simple string containing ONLY the cleaned text."""

    FUNCTION_CALLER_PROMPT = """You are an AI Analyst that calls functions based on a conversation. Follow these rules exactly.

RULES:
1.  **ANALYZE THE LATEST EXCHANGE:** Look at the most recent turn of the conversation, which is provided to you under the tag [Current_Turn]

2.  **DETECT NEW OR CORRECTED FACTS:** Your only job is to find NEW information or CORRECTED information provided by the user. 

3.  **MATCH FACTS TO TOOLS:** If you find a new/corrected fact, you MUST match it to a function in the [TOOL CATALOGUE].

4.  **STRICT TOOL USAGE:** You MUST ONLY use the function names and parameters provided. DO NOT invent functions or guess parameters.

5.  **CRITICAL RULE - DO NOTHING IF UNSURE:** If the latest exchange contains NO new facts (e.g., "yes", "okay", "that sounds good") or if you are not 100% sure, you MUST return an empty list.

This is the user (customer) data:
{customer_profile}

This is the Conversation History (Empty if there's none)
{previous_cleaned_turns}

This is a history of the past functions called for this conversation:
{previous_function_calls}

AND THIS IS THE MOST RECENT TURN, WHICH HAS THE MOST WEIGHT ON YOUR DECISION MAKING:
{current_cleaned_turn}"""

    # Model configuration
    MODEL_CONFIG = {
        "model": "gemini-2.5-flash-lite-preview-06-17",
        "temperature": 0.1,
        "top_p": 1,
        "top_k": 1,
        "max_tokens": 1000
    }

    def __init__(self, ui_callback: Optional[Callable] = None):
        """
        Initialize the production processor
        
        Args:
            ui_callback: Optional callback function for UI notifications
                        Should accept (session_id, event_type, data)
        """
        self.active_sessions: Dict[UUID, ConversationSession] = {}
        self.gemini_service = GeminiService()
        self.function_executor = FunctionExecutor()
        self.function_registry = function_registry
        self.ui_callback = ui_callback
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Default call context (can be overridden per session)
        self.default_call_context = """
Business: Quick Fit Windows
Agent: Lumen (AI Sales Assistant)
Key Terms: leads, PPC, Response-Eye-Q, lead generation, conversions
Products: Window installations, home improvement
        """.strip()
        
        logger.info("[ProductionProcessor] Initialized for real-time processing")
    
    def create_session(self, session_id: Optional[UUID] = None, 
                      call_context: Optional[str] = None,
                      customer_profile: Optional[Dict] = None) -> UUID:
        """
        Create a new conversation session
        
        Args:
            session_id: Optional session ID, will generate if not provided
            call_context: Business context for this conversation
            customer_profile: Initial customer data
        
        Returns:
            Session ID
        """
        if session_id is None:
            session_id = uuid4()
        
        session = ConversationSession(session_id)
        
        # Set context and customer profile
        if call_context:
            session.call_context = call_context
        else:
            session.call_context = self.default_call_context
            
        if customer_profile:
            session.customer_profile = customer_profile
        
        self.active_sessions[session_id] = session
        
        logger.info(f"[ProductionProcessor] Created session {session_id}")
        
        # Notify UI
        if self.ui_callback:
            self.ui_callback(session_id, "session_created", {
                "session_id": str(session_id),
                "timestamp": time.time()
            })
        
        return session_id
    
    async def process_turn(self, session_id: UUID, speaker: str, raw_text: str) -> Dict[str, Any]:
        """
        Process a single conversation turn in real-time
        
        Args:
            session_id: Active session ID
            speaker: "User" or "Lumen"
            raw_text: Raw transcribed text
        
        Returns:
            Processing result with cleaned text and any function calls
        """
        start_time = time.time()
        
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.active_sessions[session_id]
        
        # Add turn to session
        turn = session.add_turn(speaker, raw_text)
        
        # Skip processing for Lumen turns (as per original logic)
        if speaker == "Lumen":
            logger.info(f"[Session {session_id}] Skipping Lumen turn processing")
            turn.cleaned_text = raw_text  # Pass through unchanged
            
            result = {
                "session_id": str(session_id),
                "speaker": speaker,
                "raw_text": raw_text,
                "cleaned_text": raw_text,
                "function_calls": [],
                "processing_time_ms": (time.time() - start_time) * 1000
            }
            
            # Notify UI
            if self.ui_callback:
                self.ui_callback(session_id, "turn_processed", result)
            
            return result
        
        # Clean the text
        cleaned_text = await self._clean_text(session, raw_text)
        session.update_turn_cleaned_text(turn, cleaned_text)
        
        # Process function calls
        function_calls = await self._process_function_calls(session, cleaned_text)
        
        # Record function calls in session
        for call in function_calls:
            session.add_function_call(
                call["function_name"],
                call["parameters"], 
                call.get("result")
            )
        
        processing_time = (time.time() - start_time) * 1000
        
        result = {
            "session_id": str(session_id),
            "speaker": speaker,
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "function_calls": function_calls,
            "processing_time_ms": processing_time
        }
        
        logger.info(f"[Session {session_id}] Processed turn in {processing_time:.1f}ms")
        
        # Notify UI
        if self.ui_callback:
            self.ui_callback(session_id, "turn_processed", result)
            
            # Notify UI of individual function calls
            for call in function_calls:
                self.ui_callback(session_id, "function_called", {
                    "function_name": call["function_name"],
                    "parameters": call["parameters"],
                    "result": call.get("result"),
                    "timestamp": time.time()
                })
        
        return result
    
    async def _clean_text(self, session: ConversationSession, raw_text: str) -> str:
        """Clean raw text using the hardcoded cleaner prompt"""
        try:
            # Build context for cleaning
            conversation_context = session.get_cleaned_context()
            call_context = getattr(session, 'call_context', self.default_call_context)
            
            # Format the prompt
            prompt = self.CLEANER_PROMPT.format(
                call_context=call_context,
                conversation_context=conversation_context,
                raw_text=raw_text
            )
            
            # Call Gemini
            cleaned_text = await self.gemini_service.generate_text(
                prompt=prompt,
                **self.MODEL_CONFIG
            )
            
            return cleaned_text.strip()
            
        except Exception as e:
            logger.error(f"[Session {session.session_id}] Text cleaning failed: {e}")
            return raw_text  # Fallback to raw text
    
    async def _process_function_calls(self, session: ConversationSession, cleaned_text: str) -> List[Dict]:
        """Process function calls based on cleaned text"""
        try:
            # Build context for function calling
            conversation_context = session.get_cleaned_context()
            customer_profile = session.customer_profile
            
            # Get previous function calls for context
            previous_calls = []
            for call in session.function_call_history:
                previous_calls.append({
                    "function_name": call.function_name,
                    "parameters": call.parameters,
                    "result": call.result
                })
            
            # Format the function caller prompt
            prompt = self.FUNCTION_CALLER_PROMPT.format(
                customer_profile=customer_profile,
                previous_cleaned_turns=conversation_context,
                previous_function_calls=previous_calls,
                current_cleaned_turn=cleaned_text
            )
            
            # Get function definitions
            available_functions = self.function_registry.get_available_functions()
            
            # Call Gemini with function calling
            function_calls = await self.gemini_service.generate_with_functions(
                prompt=prompt,
                available_functions=available_functions,
                **self.MODEL_CONFIG
            )
            
            # Execute the functions
            executed_calls = []
            for call in function_calls:
                try:
                    result = await self.function_executor.execute_function(
                        call["function_name"],
                        call["parameters"]
                    )
                    
                    executed_calls.append({
                        "function_name": call["function_name"],
                        "parameters": call["parameters"],
                        "result": result,
                        "success": True
                    })
                    
                except Exception as e:
                    logger.error(f"Function execution failed: {e}")
                    executed_calls.append({
                        "function_name": call["function_name"],
                        "parameters": call["parameters"],
                        "error": str(e),
                        "success": False
                    })
            
            return executed_calls
            
        except Exception as e:
            logger.error(f"[Session {session.session_id}] Function calling failed: {e}")
            return []
    
    def get_session_state(self, session_id: UUID) -> Optional[Dict]:
        """Get current session state for debugging/monitoring"""
        if session_id not in self.active_sessions:
            return None
        
        session = self.active_sessions[session_id]
        
        return {
            "session_id": str(session_id),
            "created_at": session.created_at,
            "last_activity": session.last_activity,
            "total_turns": len(session.conversation_history),
            "function_calls": len(session.function_call_history),
            "customer_profile": session.customer_profile,
            "recent_turns": [
                {
                    "speaker": turn.speaker,
                    "raw_text": turn.raw_text,
                    "cleaned_text": turn.cleaned_text,
                    "timestamp": turn.timestamp
                }
                for turn in session.get_context_window()
            ]
        }
    
    def close_session(self, session_id: UUID):
        """Close and cleanup a conversation session"""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            logger.info(f"[ProductionProcessor] Closed session {session_id}")
            
            # Notify UI
            if self.ui_callback:
                self.ui_callback(session_id, "session_closed", {
                    "session_id": str(session_id),
                    "timestamp": time.time()
                })
    
    def get_active_sessions(self) -> List[UUID]:
        """Get list of active session IDs"""
        return list(self.active_sessions.keys())
    
    def cleanup_inactive_sessions(self, max_age_seconds: int = 3600):
        """Clean up sessions that have been inactive for too long"""
        current_time = time.time()
        inactive_sessions = []
        
        for session_id, session in self.active_sessions.items():
            if current_time - session.last_activity > max_age_seconds:
                inactive_sessions.append(session_id)
        
        for session_id in inactive_sessions:
            self.close_session(session_id)
            
        if inactive_sessions:
            logger.info(f"[ProductionProcessor] Cleaned up {len(inactive_sessions)} inactive sessions")


# Global instance for easy integration
production_processor = ProductionProcessor()