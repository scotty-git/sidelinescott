# Production Integration Guide: Real-Time Conversation Processing with Gemini API

## Overview

This document provides complete integration instructions for incorporating the **Lumen Transcript Cleaner** system into your live voice AI application using Google's Gemini API standard. The system processes real-time conversation turns, cleans transcribed text, and executes business functions using Gemini's native function calling.

---

## Core Codebase Files for Reference

Although the documentation is designed to be self efficient, if you need to understand the underlying implementation, these are the key Python files, Otherwise, skip this section.

### Essential Files

1. **`/backend/app/services/evaluation_manager.py`**
   - Core evaluation logic and in-memory session management
   - Shows how conversation history and context windows work
   - Contains the sliding window implementation (`get_cleaned_sliding_window()`)

2. **`/backend/app/services/gemini_service.py`**
   - Gemini API integration and text generation
   - Model configuration and API calling patterns
   - Error handling for API failures

3. **`/backend/app/services/function_executor.py`**
   - Function execution logic and result handling
   - Shows how function calls are processed and validated

4. **`/backend/app/services/function_registry.py`**
   - Complete business function definitions (same as above)
   - Function validation and schema checking
   - The exact function specs you need

### Data Models

5. **`/backend/app/models/evaluation.py`**
   - Database model showing the dataset structure
   - Field definitions and relationships

6. **`/backend/app/schemas/evaluations.py`**
   - Pydantic schemas for request/response validation
   - Shows expected data formats

### API Layer (Optional)

7. **`/backend/app/api/v1/evaluations.py`**
   - REST endpoints (you can ignore this for voice AI integration)
   - Shows how session management works in practice

### Key Patterns to Understand

- **Session Management**: How `EvaluationManager` tracks multiple conversations
- **Context Windows**: How conversation history is maintained and passed to prompts
- **Function Calling Flow**: How Gemini responses are parsed and functions executed
- **Error Handling**: Graceful degradation when APIs fail

### What You DON'T Need

- Frontend files (`/frontend/*`)
- Database migration files
- Test files (unless you want examples)
- UI-related API endpoints

The production implementation in this document extracts the core logic from these files and simplifies it for direct voice AI integration.

**This guide includes everything needed: Gemini API integration, protobuf parsing, and complete implementation code.**

## Architecture

```
Voice AI → Raw Transcripts → Gemini API (Cleaning) → Gemini API (Function Calling) → Dataset Updates → UI Updates
```

### Core Components

1. **Gemini API Integration**: Using Google's official API with function calling
2. **Dataset Management**: In-memory state tracking for conversation data
3. **Conversation Memory**: Sliding window context management
4. **UI Callback System**: Real-time notifications for Studio interface
5. **Hardcoded Prompts**: Production-optimized prompts from evaluation phase

---

## Gemini API Function Calling Implementation

### 1. Function Definitions with Standard API

```python
import google.generativeai as genai

# Configure Gemini
genai.configure(api_key="your-api-key")

# Define functions using Gemini's standard tools format
business_functions = [
    {
        "name": "update_profile_field",
        "description": "Updates a single, specific field in the prospect's company or contact profile. Use this ONLY when the user provides a direct correction or addition to a known fact about them.",
        "parameters": {
            "type": "object",
            "properties": {
                "field_to_update": {
                    "type": "string",
                    "description": "The specific field that needs to be changed.",
                    "enum": ["user_name", "job_title", "company_name", "company_description", "company_size", "company_sector"]
                },
                "new_value": {
                    "type": "string",
                    "description": "The new and correct value for the field."
                }
            },
            "required": ["field_to_update", "new_value"]
        }
    },
    {
        "name": "log_metric",
        "description": "Logs a specific quantitative metric about the business. Use this when the user states a number related to their operations.",
        "parameters": {
            "type": "object",
            "properties": {
                "metric_name": {
                    "type": "string",
                    "description": "The name of the metric being provided.",
                    "enum": ["monthly_website_visitors", "monthly_inbound_calls", "monthly_form_submissions"]
                },
                "value_string": {
                    "type": "string",
                    "description": "The value the user provided, captured exactly as a string to handle ranges or estimates (e.g., '500', '50 to 100', 'in the hundreds')."
                }
            },
            "required": ["metric_name", "value_string"]
        }
    },
    {
        "name": "record_business_insight",
        "description": "Records a key qualitative insight, problem, goal, or motivation shared by the user. Use this to capture the 'why' behind their interest or the challenges they face.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "The classification of the insight.",
                    "enum": ["CHALLENGE", "GOAL", "MOTIVATION", "STRENGTH"]
                },
                "insight_details": {
                    "type": "string",
                    "description": "The full user statement or summary of the insight."
                }
            },
            "required": ["category", "insight_details"]
        }
    },
    {
        "name": "log_marketing_channels",
        "description": "Logs the marketing or lead generation channels the user mentions.",
        "parameters": {
            "type": "object",
            "properties": {
                "channels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "A list of channels (e.g., ['PPC', 'Google', 'Checkatrade'])."
                }
            },
            "required": ["channels"]
        }
    },
    {
        "name": "initiate_demo_creation",
        "description": "Call this ONLY when the user gives explicit, positive, and unambiguous consent to create the demo, such as 'Yes, I'm ready' or 'Let's do it'.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
]
```

### 2. Complete Gemini API Client Implementation

```python
import google.generativeai as genai
import asyncio
from typing import List, Dict, Any

class GeminiClient:
    """Complete Gemini API client implementation"""
    
    def __init__(self, api_key: str):
        """Initialize Gemini client"""
        genai.configure(api_key=api_key)
        
        # Create model for text cleaning (no functions)
        self.cleaner_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite-preview-06-17",
            generation_config={
                "temperature": 0.1,
                "top_p": 1,
                "top_k": 1,
                "max_output_tokens": 1000,
            }
        )
        
        # Create model for function calling
        self.function_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite-preview-06-17",
            generation_config={
                "temperature": 0.1,
                "top_p": 1,
                "top_k": 1,
                "max_output_tokens": 1000,
            },
            tools=business_functions  # Functions defined above
        )
    
    async def generate_text(self, prompt: str) -> str:
        """Generate cleaned text (no function calling)"""
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: self.cleaner_model.generate_content(prompt)
            )
            
            # Extract text from response
            if response.parts:
                return response.text
            else:
                return prompt  # Fallback to original
                
        except Exception as e:
            logger.error(f"Gemini text generation failed: {e}")
            return prompt  # Fallback to original
    
    async def generate_with_functions(self, prompt: str) -> List[Dict[str, Any]]:
        """Generate with function calling"""
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.function_model.generate_content(prompt)
            )
            
            # Parse function calls from response
            function_calls = self._parse_function_calls(response)
            return function_calls
            
        except Exception as e:
            logger.error(f"Gemini function calling failed: {e}")
            return []  # Return empty list on error
    
    def _parse_function_calls(self, response) -> List[Dict[str, Any]]:
        """Parse function calls from Gemini response protobuf"""
        function_calls = []
        
        # Iterate through candidates
        for candidate in response.candidates:
            if not candidate.content.parts:
                continue
                
            # Check each part for function calls
            for part in candidate.content.parts:
                if part.function_call:
                    fc = part.function_call
                    function_name = fc.name
                    
                    # Parse protobuf args to dict
                    args = {}
                    for key, value in fc.args.items():
                        # Handle different protobuf value types
                        if hasattr(value, 'list_value') and value.list_value:
                            # Handle arrays/lists
                            args[key] = [
                                item.string_value if hasattr(item, 'string_value') else str(item)
                                for item in value.list_value.values
                            ]
                        elif hasattr(value, 'string_value'):
                            # Handle strings
                            args[key] = value.string_value
                        elif hasattr(value, 'number_value'):
                            # Handle numbers
                            args[key] = value.number_value
                        elif hasattr(value, 'bool_value'):
                            # Handle booleans
                            args[key] = value.bool_value
                        else:
                            # Fallback to string conversion
                            args[key] = str(value)
                    
                    function_calls.append({
                        "function_name": function_name,
                        "parameters": args
                    })
        
        return function_calls

# Usage example
gemini_client = GeminiClient(api_key="your-api-key")

# For text cleaning
cleaned_text = await gemini_client.generate_text(cleaner_prompt)

# For function calling
function_calls = await gemini_client.generate_with_functions(function_caller_prompt)
```

### 3. Understanding Gemini Response Structure

When Gemini API returns function calls, the response structure looks like this:

```python
# Example response object structure
response.candidates[0].content.parts[0].function_call
├── name: "update_profile_field"           # Function name
└── args: {                                # Function arguments (protobuf)
    "field_to_update": <Value object>      # Each arg is a protobuf Value
    "new_value": <Value object>
}

# Value object can contain:
value.string_value   # For strings
value.number_value   # For numbers  
value.bool_value     # For booleans
value.list_value     # For arrays
```

### 4. Complete Working Implementation

```python
async def _clean_text(self, session: ConversationSession, raw_text: str) -> str:
    """Clean text using Gemini API - WORKING IMPLEMENTATION"""
    try:
        # Build context
        call_context = f"""
Business: {session.dataset.company_name}
Agent: Lumen (AI Sales Assistant)
User: {session.dataset.user_name} ({session.dataset.job_title})
Company: {session.dataset.company_description}
Size: {session.dataset.company_size}
Sector: {session.dataset.company_sector}
"""
        
        conversation_context = session.get_cleaned_context()
        
        # Format prompt (using your exact prompt)
        prompt = self.CLEANER_PROMPT.format(
            call_context=call_context,
            conversation_context=conversation_context,
            raw_text=raw_text
        )
        
        # Call Gemini
        cleaned_text = await self.gemini_client.generate_text(prompt)
        return cleaned_text.strip()
        
    except Exception as e:
        logger.error(f"Text cleaning failed: {e}")
        return raw_text

async def _process_function_calls(self, session: ConversationSession, 
                                cleaned_text: str) -> List[Dict[str, Any]]:
    """Process function calls - WORKING IMPLEMENTATION"""
    try:
        # Build context
        conversation_context = session.get_cleaned_context()
        
        # Get previous function calls (simplified for production)
        previous_calls = []
        for call in session.function_call_history:
            previous_calls.append({
                "function_name": call.function_name,
                "parameters": call.parameters,
                "result": call.result
            })
        
        # Format prompt (using your exact prompt)
        prompt = self.FUNCTION_CALLER_PROMPT.format(
            customer_profile=session.dataset.__dict__,
            previous_cleaned_turns=conversation_context,
            previous_function_calls=previous_calls,
            current_cleaned_turn=cleaned_text
        )
        
        # Call Gemini with function calling
        function_calls = await self.gemini_client.generate_with_functions(prompt)
        
        # Execute functions and update dataset
        executed_calls = []
        for call in function_calls:
            try:
                result = self._execute_function(
                    session, 
                    call["function_name"], 
                    call["parameters"]
                )
                
                executed_calls.append({
                    "function_name": call["function_name"],
                    "parameters": call["parameters"],
                    "result": result,
                    "success": True
                })
                
                # Notify UI
                if self.ui_callback:
                    self.ui_callback(session.session_id, "function_called", {
                        "function_name": call["function_name"],
                        "parameters": call["parameters"],
                        "result": result,
                        "updated_dataset": session.dataset.__dict__
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
        logger.error(f"Function calling failed: {e}")
        return []
```

### 3. Parsing Protobuf Function Calls

```python
def parse_function_calls(response):
    """Parse function calls from Gemini response protobuf"""
    function_calls = []
    
    for candidate in response.candidates:
        if not candidate.content.parts:
            continue
            
        for part in candidate.content.parts:
            if part.function_call:
                fc = part.function_call
                function_name = fc.name
                
                # Parse protobuf args to dict
                args = {}
                for key, value in fc.args.items():
                    # Handle different protobuf value types
                    if hasattr(value, 'list_value'):
                        # Handle arrays/lists
                        args[key] = [str(item.string_value) for item in value.list_value.values]
                    elif hasattr(value, 'string_value'):
                        # Handle strings
                        args[key] = value.string_value
                    elif hasattr(value, 'number_value'):
                        # Handle numbers
                        args[key] = value.number_value
                    else:
                        # Fallback to string conversion
                        args[key] = str(value)
                
                function_calls.append({
                    "function_name": function_name,
                    "parameters": args
                })
    
    return function_calls
```

### 4. Dataset Management

```python
@dataclass
class Dataset:
    """Dataset matching your working database model"""
    # Core customer fields (static)
    user_name: str = "Scott"
    job_title: str = "Head of Marketing" 
    company_name: str = "Quick Fit Windows"
    company_description: str = "a residential and commercial emergency window repair company based in Gloucestershire, England"
    company_size: str = "20 to 50 people"
    company_sector: str = "window repairs"
    
    # Single JSON field containing all dynamic data (matching your working format)
    business_insights: Dict[str, Any] = field(default_factory=lambda: {
        "marketing_channels": [],
        "insights": [],
        "metrics": {},
        "demo_creation_initiated": None
    })
    
    # Timestamps
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    
    def update_timestamp(self):
        """Update the updated_at timestamp when dataset changes"""
        self.updated_at = time.time()

def execute_function(dataset: Dataset, function_name: str, args: Dict) -> Dict:
    """Execute function and update dataset"""
    if function_name == "update_profile_field":
        field = args["field_to_update"]
        value = args["new_value"]
        
        if hasattr(dataset, field):
            setattr(dataset, field, value)
            dataset.update_timestamp()
            return {"success": True, "field": field, "new_value": value}
        else:
            return {"success": False, "error": f"Unknown field: {field}"}
    
    elif function_name == "log_metric":
        metric = args["metric_name"]
        value = args["value_string"]
        
        # Update metrics in business_insights JSON
        dataset.business_insights["metrics"][metric] = value
        dataset.update_timestamp()
        return {"success": True, "metric": metric, "value": value}
    
    elif function_name == "record_business_insight":
        category = args["category"]
        details = args["insight_details"]
        
        # Add to insights array in business_insights JSON
        dataset.business_insights["insights"].append({
            "category": category,
            "details": details,
            "timestamp": time.time()
        })
        dataset.update_timestamp()
        return {"success": True, "category": category}
    
    elif function_name == "log_marketing_channels":
        channels = args["channels"]
        
        # Update marketing_channels in business_insights JSON
        dataset.business_insights["marketing_channels"].extend(channels)
        dataset.business_insights["marketing_channels"] = list(set(dataset.business_insights["marketing_channels"]))  # Dedupe
        dataset.update_timestamp()
        return {"success": True, "channels": channels}
    
    elif function_name == "initiate_demo_creation":
        # Update demo_creation_initiated in business_insights JSON
        dataset.business_insights["demo_creation_initiated"] = {
            "timestamp": time.time(),
            "status": "initiated"
        }
        dataset.update_timestamp()
        return {"success": True, "demo_initiated": True}
    
    else:
        return {"success": False, "error": f"Unknown function: {function_name}"}
```

---

## Complete Implementation Code

### Production Processor with Your Exact Prompts

```python
"""
Production Processor using your exact prompts and configurations
"""

import time
import logging
from typing import Dict, List, Optional, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass, field
import google.generativeai as genai

logger = logging.getLogger(__name__)

```python
"""
ProductionProcessor - Real-time conversation processing for live voice AI integration

This is the production-ready version of the evaluation system, optimized for real-time
processing with voice AI systems. No evaluation overhead - just core conversation 
cleaning and function calling.
"""

import time
import logging
import asyncio
import json
from typing import Dict, List, Optional, Any, Callable
from uuid import UUID, uuid4
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

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
        self.call_context: str = ""
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

# Business Function Definitions
BUSINESS_FUNCTIONS = {
    "update_profile_field": {
        "description": "Updates a single, specific field in the prospect's company or contact profile. Use this ONLY when the user provides a direct correction or addition to a known fact about them.",
        "parameters": {
            "type": "object",
            "properties": {
                "field_to_update": {
                    "type": "string",
                    "description": "The specific field that needs to be changed.",
                    "enum": ["user_name", "job_title", "company_name", "company_description", "company_size", "company_sector"]
                },
                "new_value": {
                    "type": "string",
                    "description": "The new and correct value for the field."
                }
            },
            "required": ["field_to_update", "new_value"]
        }
    },
    "log_metric": {
        "description": "Logs a specific quantitative metric about the business. Use this when the user states a number related to their operations.",
        "parameters": {
            "type": "object",
            "properties": {
                "metric_name": {
                    "type": "string",
                    "description": "The name of the metric being provided.",
                    "enum": ["monthly_website_visitors", "monthly_inbound_calls", "monthly_form_submissions"]
                },
                "value_string": {
                    "type": "string",
                    "description": "The value the user provided, captured exactly as a string to handle ranges or estimates (e.g., '500', '50 to 100', 'in the hundreds')."
                }
            },
            "required": ["metric_name", "value_string"]
        }
    },
    "record_business_insight": {
        "description": "Records a key qualitative insight, problem, goal, or motivation shared by the user. Use this to capture the 'why' behind their interest or the challenges they face.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "The classification of the insight.",
                    "enum": ["CHALLENGE", "GOAL", "MOTIVATION", "STRENGTH"]
                },
                "insight_details": {
                    "type": "string",
                    "description": "The full user statement or summary of the insight."
                }
            },
            "required": ["category", "insight_details"]
        }
    },
    "log_marketing_channels": {
        "description": "Logs the marketing or lead generation channels the user mentions.",
        "parameters": {
            "type": "object",
            "properties": {
                "channels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "A list of channels (e.g., ['PPC', 'Google', 'Checkatrade'])."
                }
            },
            "required": ["channels"]
        }
    },
    "initiate_demo_creation": {
        "description": "Call this ONLY when the user gives explicit, positive, and unambiguous consent to create the demo, such as 'Yes, I'm ready' or 'Let's do it'.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
}

class ProductionProcessor:
    """
    Production-ready real-time conversation processor
    
    This class handles:
    1. Real-time turn processing as they come from voice AI
    2. Text cleaning using hardcoded optimized prompt
    3. Function calling based on cleaned text
    4. UI notifications via callbacks
    5. Memory management for ongoing conversations
    """
    
    # Hardcoded optimized prompts from evaluation phase
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
1.  Actively Cross-Reference Ground Truth: Before finalizing any correction, you MUST check if a potentially garbled word in the `RAW TEXT` corresponds to a term, name, or concept in the `CALL_CONTEXT`. If a plausible match exists (e.g., "legion" sounds like "lead generation"), the `CALL_CONTEXT` term MUST be prioritized.
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
{current_cleaned_turn}

    # Model configuration
    MODEL_CONFIG = {
        "model": "gemini-2.5-flash-lite-preview-06-17",
        "temperature": 0.1,
        "top_p": 1,
        "top_k": 1,
        "max_tokens": 1000
    }

    def __init__(self, gemini_api_key: str, ui_callback: Optional[Callable] = None):
        """
        Initialize the production processor
        
        Args:
            gemini_api_key: Your Gemini API key
            ui_callback: Optional callback function for UI notifications
                        Should accept (session_id, event_type, data)
        """
        self.active_sessions: Dict[UUID, ConversationSession] = {}
        self.gemini_api_key = gemini_api_key
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
            call_context = session.call_context
            
            # Format the prompt
            prompt = self.CLEANER_PROMPT.format(
                call_context=call_context,
                conversation_context=conversation_context,
                raw_text=raw_text
            )
            
            # Call Gemini (you'll need to implement this based on your Gemini client)
            cleaned_text = await self._call_gemini(prompt)
            
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
            
            # Create function catalog
            function_catalog = json.dumps(list(BUSINESS_FUNCTIONS.values()), indent=2)
            
            # Format the function caller prompt
            prompt = self.FUNCTION_CALLER_PROMPT.format(
                customer_profile=customer_profile,
                previous_cleaned_turns=conversation_context,
                previous_function_calls=previous_calls,
                current_cleaned_turn=cleaned_text,
                function_catalog=function_catalog
            )
            
            # Call Gemini with function calling
            function_calls = await self._call_gemini_with_functions(prompt)
            
            # Execute the functions
            executed_calls = []
            for call in function_calls:
                try:
                    result = await self._execute_function(
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
    
    async def _call_gemini(self, prompt: str) -> str:
        """
        Call Gemini API for text generation
        
        NOTE: You need to implement this method based on your Gemini client
        """
        # Placeholder - implement with your Gemini client
        # Example:
        # return await your_gemini_client.generate_text(
        #     prompt=prompt,
        #     **self.MODEL_CONFIG
        # )
        raise NotImplementedError("Implement Gemini API call based on your client")
    
    async def _call_gemini_with_functions(self, prompt: str) -> List[Dict]:
        """
        Call Gemini API with function calling capabilities
        
        NOTE: You need to implement this method based on your Gemini client
        """
        # Placeholder - implement with your Gemini client
        # Should return list of function calls to execute
        raise NotImplementedError("Implement Gemini function calling based on your client")
    
    async def _execute_function(self, function_name: str, parameters: Dict) -> Any:
        """
        Execute a business function
        
        NOTE: You need to implement the actual business logic for each function
        """
        if function_name == "update_profile_field":
            # Update customer profile field
            field = parameters["field_to_update"]
            value = parameters["new_value"]
            # Your implementation here
            return {"success": True, "field": field, "value": value}
        
        elif function_name == "log_metric":
            # Log business metric
            metric_name = parameters["metric_name"]
            value_string = parameters["value_string"]
            # Your implementation here
            return {"success": True, "metric": metric_name, "value": value_string}
        
        elif function_name == "record_business_insight":
            # Record business insight
            category = parameters["category"]
            details = parameters["insight_details"]
            # Your implementation here
            return {"success": True, "category": category, "insight_id": "generated_id"}
        
        elif function_name == "log_marketing_channels":
            # Log marketing channels
            channels = parameters["channels"]
            # Your implementation here
            return {"success": True, "channels": channels}
        
        elif function_name == "initiate_demo_creation":
            # Initiate demo creation process
            # Your implementation here
            return {"success": True, "demo_initiated": True, "demo_id": "generated_demo_id"}
        
        else:
            raise ValueError(f"Unknown function: {function_name}")
    
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
```

---

## Integration Steps

### 1. Service Initialization

```python
from app.services.production_processor import production_processor

# Define your UI callback function
def handle_ui_updates(session_id, event_type, data):
    """
    Handle real-time UI updates
    
    Args:
        session_id (UUID): Conversation session identifier
        event_type (str): Type of event ("turn_processed", "function_called", etc.)
        data (dict): Event payload
    """
    if event_type == "turn_processed":
        # Update Studio UI with cleaned transcript
        update_transcript_display(data["cleaned_text"])
        
    elif event_type == "function_called":
        # Trigger Studio UI changes based on function calls
        handle_function_ui_update(data["function_name"], data["parameters"])

# Initialize the processor with your callback
production_processor.ui_callback = handle_ui_updates
```

### 2. Session Management

```python
# Start a new conversation
session_id = production_processor.create_session(
    call_context="Business: Quick Fit Windows\nAgent: Lumen\nProducts: Window installations",
    customer_profile={"name": "John Doe", "phone": "+1234567890"}
)

# Process turns as they arrive from voice AI
async def process_voice_input(speaker, raw_transcript):
    """
    Process each turn from your voice AI system
    
    Args:
        speaker (str): "User" or "Lumen" 
        raw_transcript (str): Raw STT output
    """
    result = await production_processor.process_turn(
        session_id=session_id,
        speaker=speaker, 
        raw_text=raw_transcript
    )
    
    return result

# End conversation
production_processor.close_session(session_id)
```

### 3. Response Structure

Each `process_turn()` call returns:

```python
{
    "session_id": "uuid-string",
    "speaker": "User" | "Lumen",
    "raw_text": "original transcribed text",
    "cleaned_text": "corrected text",
    "function_calls": [
        {
            "function_name": "update_customer_info",
            "parameters": {"name": "John", "phone": "+1234567890"},
            "result": {"success": True, "customer_id": 123},
            "success": True
        }
    ],
    "processing_time_ms": 45.2
}
```

## UI Callback Events

Your callback function will receive these event types:

### `"session_created"`
```python
data = {
    "session_id": "uuid-string",
    "timestamp": 1640995200.0
}
```

### `"turn_processed"`
```python
data = {
    "session_id": "uuid-string",
    "speaker": "User",
    "raw_text": "I need help with my order",
    "cleaned_text": "I need help with my order",
    "function_calls": [...],
    "processing_time_ms": 67.3
}
```

### `"function_called"`
```python
data = {
    "function_name": "update_customer_info",
    "parameters": {"name": "John", "email": "john@example.com"},
    "result": {"success": True, "customer_id": 123},
    "timestamp": 1640995200.0
}
```

### `"session_closed"`
```python
data = {
    "session_id": "uuid-string", 
    "timestamp": 1640995200.0
}
```

## Performance Characteristics

- **Target Processing Time**: <100ms per turn
- **Memory Management**: Automatic cleanup of inactive sessions
- **Lumen Turn Handling**: Bypassed for minimal latency (~10ms)
- **User Turn Processing**: Full cleaning + function calling pipeline
- **Context Window**: Maintains last 10 turns for conversation context

## Error Handling

The system includes graceful degradation:

```python
# Text cleaning failure → returns raw text
# Function calling failure → logs error, continues processing
# Session not found → raises ValueError
```

## Monitoring and Debugging

```python
# Get session state for debugging
state = production_processor.get_session_state(session_id)
print(f"Session has {state['total_turns']} turns")

# List active sessions
active = production_processor.get_active_sessions()
print(f"Currently managing {len(active)} conversations")

# Cleanup inactive sessions (runs automatically)
production_processor.cleanup_inactive_sessions(max_age_seconds=3600)
```

## Function Registry Integration

The system automatically detects and executes business functions. Available functions are defined in `app/services/function_registry.py`. When functions are called:

1. **Detection**: AI analyzes cleaned text for new customer information
2. **Execution**: Functions run with extracted parameters  
3. **UI Notification**: Your callback receives function call details
4. **Studio Update**: You handle UI changes based on function type

### Common Function Types
- `update_customer_info`: Customer data updates
- `schedule_appointment`: Calendar integration
- `generate_quote`: Pricing calculations
- `update_lead_status`: CRM updates

## Integration Checklist

- [ ] Import `production_processor` in your voice AI service
- [ ] Implement UI callback function for Studio updates
- [ ] Create session when conversation starts
- [ ] Call `process_turn()` for each voice AI transcript
- [ ] Handle function call notifications in UI
- [ ] Close session when conversation ends
- [ ] Test with sample conversation flow
- [ ] Monitor processing times and errors

## Example Integration

```python
class VoiceAIIntegration:
    def __init__(self):
        self.production_processor = production_processor
        self.production_processor.ui_callback = self.handle_ui_update
        self.active_session = None
    
    def start_conversation(self, customer_context=None):
        """Start new conversation session"""
        self.active_session = self.production_processor.create_session(
            customer_profile=customer_context or {}
        )
        return self.active_session
    
    async def on_voice_input(self, speaker, transcript):
        """Handle each voice input from AI system"""
        if not self.active_session:
            raise ValueError("No active conversation session")
            
        result = await self.production_processor.process_turn(
            session_id=self.active_session,
            speaker=speaker,
            raw_text=transcript
        )
        
        # Optional: Return cleaned text to voice AI for consistency
        return result["cleaned_text"]
    
    def handle_ui_update(self, session_id, event_type, data):
        """Handle real-time UI updates"""
        if event_type == "function_called":
            # Update Studio interface based on function type
            function_name = data["function_name"]
            
            if function_name == "update_customer_info":
                self.update_customer_display(data["parameters"])
            elif function_name == "schedule_appointment":
                self.show_calendar_booking(data["result"])
            # Add more function handlers as needed
    
    def end_conversation(self):
        """Clean up conversation session"""
        if self.active_session:
            self.production_processor.close_session(self.active_session)
            self.active_session = None
```

## Support

For technical questions or issues:
1. Check processing times via session state monitoring
2. Verify callback function is receiving events
3. Review logs for function execution errors
4. Ensure proper session lifecycle management

The system is designed for high reliability and performance in production voice AI environments.