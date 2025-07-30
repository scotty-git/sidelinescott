"""
Gemini Service - Integration with Google Gemini 2.5 Flash-Lite for conversation cleaning

CRITICAL: Uses Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite-preview-06-17) for 
cost-efficient, high-performance conversation cleaning with CleanerContext-aware 
prompting and stateful processing.

This is Google's most cost-effective and speed-optimized model in the Gemini 2.5 family,
specifically chosen for high-volume transcript processing applications.
"""

import json
import time
import logging
import asyncio
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import requests
from unittest.mock import patch
import urllib3

from app.core.config import settings

# Try to import httpx and aiohttp which are used by google-generativeai
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

logger = logging.getLogger(__name__)

# Gemini 2.5 Flash-Lite pricing (per 1M tokens) - Official Google AI Studio rates
GEMINI_FLASH_LITE_INPUT_COST = 0.10   # $0.10 per 1M input tokens (text/image/video)
GEMINI_FLASH_LITE_OUTPUT_COST = 0.40  # $0.40 per 1M output tokens

def extract_token_usage(response) -> tuple[int, int]:
    """Extract token usage from Gemini response"""
    try:
        if hasattr(response, 'usage_metadata'):
            usage = response.usage_metadata
            prompt_tokens = getattr(usage, 'prompt_token_count', 0)
            completion_tokens = getattr(usage, 'candidates_token_count', 0)
            
            # Debug logging to verify token extraction
            print(f"🔍 TOKEN DEBUG: usage_metadata fields: {[attr for attr in dir(usage) if not attr.startswith('_')]}")
            print(f"🔍 TOKEN DEBUG: prompt_token_count = {prompt_tokens}")
            print(f"🔍 TOKEN DEBUG: candidates_token_count = {completion_tokens}")
            if hasattr(usage, 'total_token_count'):
                print(f"🔍 TOKEN DEBUG: total_token_count = {getattr(usage, 'total_token_count', 0)}")
            
            return prompt_tokens, completion_tokens
        return 0, 0
    except Exception as e:
        print(f"🔍 TOKEN DEBUG ERROR: {e}")
        return 0, 0

def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    """Calculate cost based on token usage"""
    input_cost = (input_tokens / 1_000_000) * GEMINI_FLASH_LITE_INPUT_COST
    output_cost = (output_tokens / 1_000_000) * GEMINI_FLASH_LITE_OUTPUT_COST
    return input_cost + output_cost

class GeminiService:
    """Service for Gemini 2.5 Flash-Lite conversation cleaning
    
    CRITICAL: Always uses gemini-2.5-flash-lite-preview-06-17 for cost efficiency
    and speed optimization as required by Scott's specifications.
    """
    
    def __init__(self):
        # Configure Gemini with API key
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # CRITICAL: Use Gemini 2.5 Flash-Lite as specified in CLAUDE.md
        self.model_name = "gemini-2.5-flash-lite-preview-06-17"
        
        # Code generation tracking
        self.captured_code_examples = []
        
        # Initialize model with safety settings for conversation content
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        # Generation config for consistent output
        self.generation_config = {
            "temperature": 0.1,  # Low temperature for consistent cleaning
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
            # Removed JSON mime type - expecting raw string response
        }
        
        try:
            self.model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config=self.generation_config,
                safety_settings=self.safety_settings
            )
            logger.info(f"Initialized Gemini service with model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini 2.5 Flash-Lite: {e}")
            # Fallback to alternative Flash-Lite model name
            try:
                self.model = genai.GenerativeModel("gemini-2.5-flash-lite")
                self.model_name = "gemini-2.5-flash-lite"
                logger.warning(f"Fallback to {self.model_name}")
            except Exception as fallback_error:
                logger.error(f"Gemini initialization failed completely: {fallback_error}")
                raise
    
    async def clean_conversation_turn(
        self, 
        raw_text: str, 
        speaker: str,
        cleaned_context: List[Dict[str, Any]],
        cleaning_level: str = "full",
        model_params: Dict[str, Any] = None,
        rendered_prompt: str = None
    ) -> Dict[str, Any]:
        """
        Clean a single conversation turn using CleanerContext methodology
        
        Args:
            raw_text: Raw text to clean (with STT errors, noise, etc.)
            speaker: "User" or "Lumen" 
            cleaned_context: Previous cleaned turns for context
            cleaning_level: "none", "light", or "full"
            
        Returns:
            CleanerResponse format with cleaned text and metadata
        """
        start_time = time.time()
        
        logger.info(f"Cleaning {speaker} turn: '{raw_text[:50]}...' (level: {cleaning_level})")
        
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
        
        # For user turns, apply cleaning based on level
        if cleaning_level == "none":
            return {
                "cleaned_text": raw_text,
                "metadata": {
                    "confidence_score": "HIGH",
                    "cleaning_applied": False,
                    "cleaning_level": "none", 
                    "corrections": [],
                    "context_detected": "user_input_clean",
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
            # Enhanced logging for debugging hangs
            logger.info(f"Starting Gemini API call for {speaker} turn")
            api_start = time.time()
            
            # Use custom model parameters if provided
            if model_params:
                # Create a custom generation config for this request
                custom_config = {
                    "temperature": model_params.get("temperature", 0.1),
                    "top_p": model_params.get("top_p", 0.8),
                    "top_k": model_params.get("top_k", 40),
                    "max_output_tokens": model_params.get("max_tokens", 2048),
                    # Removed JSON mime type - expecting raw string response
                }
                
                # Use custom model name if provided, otherwise use default
                model_name = model_params.get("model_name", self.model_name)
                
                # Create temporary model with custom config
                custom_model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config=custom_config,
                    safety_settings=self.safety_settings
                )
                
                logger.info(f"Using custom model: {model_name}")
                logger.info(f"Using custom model params: {custom_config}")
                response = await self._call_gemini_with_timeout(custom_model, prompt, timeout_seconds=3, model_config={
                    'model_name': model_name,
                    'generation_config': custom_config,
                    'safety_settings': {k.name: v.name for k, v in self.safety_settings.items()}
                })
            else:
                # Use default model
                logger.info(f"Using default model configuration")
                response = await self._call_gemini_with_timeout(self.model, prompt, timeout_seconds=3)
            
            api_time = round((time.time() - api_start) * 1000, 2)
            logger.info(f"Gemini API call completed in {api_time}ms")
            
            # Validate response
            if not response or not response.text:
                logger.error(f"Empty response from Gemini API")
                return self._fallback_response(raw_text, start_time, "empty_response")
            
            # Process raw string response
            logger.info(f"Processing raw string response: {response.text[:200]}...")
            cleaned_text = response.text.strip()
            
            processing_time = round((time.time() - start_time) * 1000, 2)
            
            # Extract token usage and calculate cost
            input_tokens, output_tokens = extract_token_usage(response)
            cost_usd = calculate_cost(input_tokens, output_tokens)
            
            # Simple metadata for MVP - no complex logic needed
            cleaned_response = {
                "cleaned_text": cleaned_text,
                "metadata": {
                    "confidence_score": "MEDIUM",  # Default for MVP
                    "cleaning_applied": raw_text.strip() != cleaned_text.strip(),  # Simple comparison
                    "cleaning_level": cleaning_level,
                    "corrections": [],  # Empty for MVP
                    "context_detected": "business_conversation",  # Default for MVP
                    "processing_time_ms": processing_time,
                    "ai_model_used": model_params.get("model_name", self.model_name) if model_params else self.model_name
                },
                "raw_response": response.text,  # Store the raw Gemini response
                "prompt_used": prompt,  # Store the actual prompt that was sent to Gemini
                # New cost tracking fields
                "token_usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens
                },
                "cost_usd": cost_usd
            }
            
            logger.info(f"Cleaned in {processing_time}ms, confidence: {cleaned_response['metadata']['confidence_score']}")
            return cleaned_response
            
        except asyncio.TimeoutError:
            logger.error(f"🚨 GEMINI API TIMEOUT: Call timed out after 3 seconds for {speaker} turn")
            logger.error(f"🚨 TIMEOUT DETAILS: Raw text length: {len(raw_text)} chars, Speaker: {speaker}")
            print(f"[GeminiService] 🚨 CRITICAL: Gemini API timeout after 3 seconds!")
            print(f"[GeminiService] 🚨 Turn details: {speaker} - '{raw_text[:100]}...'")
            return self._fallback_response(raw_text, start_time, "api_timeout_3s")
        except Exception as e:
            logger.error(f"Gemini cleaning failed: {e}")
            return self._fallback_response(raw_text, start_time, "api_error")
    
    async def call_with_native_tools(
        self,
        contents: List[Dict[str, Any]],
        tools: List[Dict[str, Any]], 
        tool_config: Dict[str, Any],
        model_params: Dict[str, Any],
        timeout_seconds: int = 3
    ) -> Dict[str, Any]:
        """Call Gemini API using native function calling"""
        start_time = time.time()
        
        # EVALUATION PLATFORM: NO DEFAULTS - use exactly what user configured
        custom_config = {
            "temperature": model_params['temperature'],  # Will raise KeyError if missing
            "top_p": model_params['top_p'],
            "top_k": model_params['top_k'], 
            "max_output_tokens": model_params['max_tokens'],
        }
        
        model_name = model_params['model_name']  # Will raise KeyError if missing
        
        # Create model with tools and user's exact configuration
        custom_model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=custom_config,
            safety_settings=self.safety_settings,
            tools=tools
        )
        
        try:
            response = await self._call_gemini_with_native_tools(
                custom_model, contents, tool_config, timeout_seconds,
                model_config={
                    'model_name': model_name,
                    'generation_config': custom_config,
                    'safety_settings': {k.name: v.name for k, v in self.safety_settings.items()},
                    'tools': tools,
                    'tool_config': tool_config
                }
            )
            
            if not response:
                raise Exception("Empty response from native function calling API")
            
            processing_time = round((time.time() - start_time) * 1000, 2)
            result = self._parse_native_function_response(response, processing_time, model_params)
            
            return result
            
        except asyncio.TimeoutError:
            raise Exception(f"Native function calling API timeout after {timeout_seconds} seconds")
        except Exception as e:
            raise Exception(f"Native function calling failed: {e}")
    
    def _build_cleaning_prompt(
        self, 
        raw_text: str, 
        cleaned_context: List[Dict[str, Any]], 
        cleaning_level: str
    ) -> str:
        """Build CleanerContext-aware prompt for Gemini"""
        
        # Build context from cleaned conversation history
        context_str = ""
        if cleaned_context:
            context_str = "\n".join([
                f"{turn['speaker']}: {turn['cleaned_text']}" 
                for turn in cleaned_context[-5:]  # Last 5 turns
            ])
        
        prompt = f"""You are an expert conversation cleaner specializing in speech-to-text error correction.

CRITICAL INSTRUCTIONS:
1. Clean ONLY speech-to-text errors, noise, and clarity issues
2. PRESERVE the speaker's original meaning and intent 100%
3. Do NOT add, remove, or change any factual content
4. Do NOT correct business information, names, or domain-specific terms unless clearly wrong
5. Fix only: unclear words, noise artifacts, repetition, filler words, obvious transcription errors

CONTEXT (cleaned conversation history):
{context_str}

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

        return prompt
    
    async def _call_gemini_with_timeout(self, model, prompt: str, timeout_seconds: int = 3, model_config: Dict[str, Any] = None):
        """Call Gemini API with timeout and capture actual function call"""
        try:
            # Wrap the synchronous call in an executor to make it awaitable
            loop = asyncio.get_event_loop()
            
            def _sync_call():
                return model.generate_content(prompt)
            
            # Run with timeout
            response = await asyncio.wait_for(
                loop.run_in_executor(None, _sync_call),
                timeout=timeout_seconds
            )
            
            # Use provided model config or default
            if model_config:
                captured_model_config = model_config
            else:
                captured_model_config = {
                    'model_name': self.model_name,
                    'generation_config': self.generation_config,
                    'safety_settings': {k.name: v.name for k, v in self.safety_settings.items()}
                }
            
            # Capture the actual function call that was made
            actual_call = {
                'function_call': f'model.generate_content(prompt)',
                'model_config': captured_model_config,
                'prompt': prompt,
                'response': response.text,
                'timestamp': time.time(),
                'success': True
            }
            
            # Store the actual call for this turn
            self.captured_code_examples.append(actual_call)
            
            print(f"[GeminiService] ✅ Captured actual function call")
            print(f"[GeminiService] 📊 Total captured calls: {len(self.captured_code_examples)}")
            
            return response
            
        except asyncio.TimeoutError:
            logger.error(f"🚨 GEMINI TIMEOUT: API call exceeded {timeout_seconds}s limit")
            print(f"[GeminiService] 🚨 API TIMEOUT: {timeout_seconds}s exceeded")
            raise
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise
    
    def get_latest_captured_call(self) -> Optional[Dict[str, Any]]:
        """Get the latest captured function call"""
        if self.captured_code_examples:
            return self.captured_code_examples[-1]
        return None
    
    def clear_captured_calls(self):
        """Clear all captured function calls"""
        self.captured_code_examples = []
    
    def debug_captured_calls(self):
        """Debug method to print all captured function calls"""
        print(f"[GeminiService] 🔍 Total captured calls: {len(self.captured_code_examples)}")
        for i, call in enumerate(self.captured_code_examples):
            print(f"[GeminiService] 📋 Call {i+1}: {call['function_call']}")
            print(f"[GeminiService] 📋 Model: {call['model_config']['model_name']}")
            print(f"[GeminiService] 📋 Success: {call['success']}")
        return self.captured_code_examples
    
    def _fallback_response(self, raw_text: str, start_time: float, error_type: str = "unknown") -> Dict[str, Any]:
        """Generate fallback response when Gemini fails"""
        logger.warning(f"Using fallback response due to: {error_type}")
        return {
            "cleaned_text": raw_text,
            "metadata": {
                "confidence_score": "LOW",
                "cleaning_applied": False,
                "cleaning_level": "none",
                "corrections": [],
                "context_detected": f"fallback_{error_type}",
                "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                "ai_model_used": f"fallback_{error_type}",
                "error_type": error_type
            },
            "raw_response": None  # No response available for fallback
        }
    
    def get_available_models(self) -> List[str]:
        """Get list of available Gemini models"""
        try:
            models = list(genai.list_models())
            return [model.name for model in models if 'generateContent' in model.supported_generation_methods]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    async def _call_gemini_with_native_tools(self, model, contents: List[Dict], tool_config: Dict, timeout_seconds: int, model_config: Dict[str, Any] = None):
        """Call Gemini API with native tools and capture actual function call"""
        try:
            # Wrap the synchronous call in an executor to make it awaitable
            loop = asyncio.get_event_loop()
            
            def _sync_call():
                return model.generate_content(contents)
            
            # Run with timeout
            response = await asyncio.wait_for(
                loop.run_in_executor(None, _sync_call),
                timeout=timeout_seconds
            )
            
            # Capture the actual function call that was made
            actual_call = {
                'function_call': f'model.generate_content(contents) with native tools',
                'model_config': model_config or {},
                'contents': contents,
                'response': str(response),  # Store full response for inspection
                'response_summary': self._extract_response_content(response),  # Keep summary for logging
                'timestamp': time.time(),
                'success': True
            }
            
            # Store the actual call for this turn
            self.captured_code_examples.append(actual_call)
            
            return response
            
        except Exception as e:
            # Capture failed call
            failed_call = {
                'function_call': f'model.generate_content(contents) with native tools - FAILED',
                'model_config': model_config or {},
                'contents': contents,
                'error': str(e),
                'timestamp': time.time(),
                'success': False
            }
            self.captured_code_examples.append(failed_call)
            raise
    
    def _extract_response_content(self, response):
        """Extract content from native function calling response for logging"""
        try:
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    parts = candidate.content.parts
                    if parts:
                        part = parts[0]
                        if hasattr(part, 'function_call'):
                            return f"Function call: {part.function_call.name}"
                        elif hasattr(part, 'text'):
                            return part.text[:200]  # First 200 chars
            return "No extractable content"
        except:
            return "Content extraction failed"
    
    def _parse_native_function_response(self, response, processing_time: float, model_params: Dict[str, Any]) -> Dict[str, Any]:
        """Parse native function calling response from Gemini - supports parallel function calls"""
        try:
            # Extract token usage and calculate cost at the beginning
            input_tokens, output_tokens = extract_token_usage(response)
            cost_usd = calculate_cost(input_tokens, output_tokens)
            # 🚨 DEBUG: Show complete raw response structure
            print(f"[GeminiService] 🔍 RAW RESPONSE DEBUG:")
            print(f"[GeminiService] 🔍 Response type: {type(response)}")
            print(f"[GeminiService] 🔍 Response string representation: {str(response)}")
            print(f"[GeminiService] 🔍 Response dir: {[attr for attr in dir(response) if not attr.startswith('_')]}")
            
            if not hasattr(response, 'candidates') or not response.candidates:
                print(f"[GeminiService] ⛔️ No candidates in response")
                raise Exception("No candidates in response")
            
            print(f"[GeminiService] 🔍 Number of candidates: {len(response.candidates)}")
            candidate = response.candidates[0]
            print(f"[GeminiService] 🔍 Candidate type: {type(candidate)}")
            print(f"[GeminiService] 🔍 Candidate dir: {[attr for attr in dir(candidate) if not attr.startswith('_')]}")
            
            if not hasattr(candidate, 'content') or not candidate.content:
                print(f"[GeminiService] ⛔️ No content in candidate")
                raise Exception("No content in candidate")
            
            print(f"[GeminiService] 🔍 Content type: {type(candidate.content)}")
            print(f"[GeminiService] 🔍 Content dir: {[attr for attr in dir(candidate.content) if not attr.startswith('_')]}")
            
            parts = candidate.content.parts
            if not parts:
                print(f"[GeminiService] ⛔️ No parts in content")
                raise Exception("No parts in content")
            
            print(f"[GeminiService] 🔍 Number of parts: {len(parts)}")
            
            # Parse all parts to collect multiple function calls
            function_calls = []
            text_responses = []
            
            for i, part in enumerate(parts):
                print(f"[GeminiService] 🔍 Part {i} type: {type(part)}")
                print(f"[GeminiService] 🔍 Part {i} dir: {[attr for attr in dir(part) if not attr.startswith('_')]}")
                
                if hasattr(part, 'function_call'):
                    # Found a function call
                    function_call = part.function_call
                    print(f"[GeminiService] 🔍 Function call found: {function_call.name}")
                    print(f"[GeminiService] 🔍 Function call type: {type(function_call)}")
                    print(f"[GeminiService] 🔍 Function call dir: {[attr for attr in dir(function_call) if not attr.startswith('_')]}")
                    print(f"[GeminiService] 🔍 Function call args type: {type(function_call.args)}")
                    print(f"[GeminiService] 🔍 Function call args str: {str(function_call.args)}")
                    print(f"[GeminiService] 🔍 Function call args dir: {[attr for attr in dir(function_call.args) if not attr.startswith('_')]}")
                    
                    # --- START: Robust, Recursive Proto-to-Dict Converter ---
                    args_dict = {}
                    if function_call.args:
                        def to_dict_recursively(proto_obj):
                            # Base case: if it's not a collection, return it as is
                            if not hasattr(proto_obj, 'items') and not hasattr(proto_obj, 'append'):
                                return proto_obj

                            # If it's dict-like (MapComposite)
                            if hasattr(proto_obj, 'items'):
                                return {key: to_dict_recursively(value) for key, value in proto_obj.items()}
                            
                            # If it's list-like (RepeatedComposite)
                            if hasattr(proto_obj, 'append'):
                                return [to_dict_recursively(item) for item in proto_obj]
                            
                            # Fallback for any other type
                            return str(proto_obj)

                        try:
                            args_dict = to_dict_recursively(function_call.args)
                            print(f"[GeminiService] ✅ SUCCESS with recursive conversion: {args_dict}")
                        except Exception as e:
                            print(f"[GeminiService] ⛔️ CRITICAL ERROR: Recursive conversion failed: {e}")
                            args_dict = {}
                    else:
                        print(f"[GeminiService] ⛔️ Function call args is None or empty")
                    # --- END: Robust, Recursive Proto-to-Dict Converter ---
                    
                    function_calls.append({
                        "name": function_call.name,
                        "args": args_dict
                    })
                elif hasattr(part, 'text'):
                    # Found text response
                    print(f"[GeminiService] 🔍 Text response found: {part.text[:100]}...")
                    text_responses.append(part.text)
                else:
                    print(f"[GeminiService] 🔍 Unknown part type in response")
            
            # Determine response type and format
            if function_calls:
                # One or more function calls found
                if len(function_calls) == 1:
                    # Single function call - maintain backward compatibility
                    return {
                        "function_call": function_calls[0],
                        "function_calls": function_calls,  # Also provide as array
                        "metadata": {
                            "processing_time_ms": processing_time,
                            "ai_model_used": model_params.get('model_name', 'unknown'),
                            "response_type": "function_call",
                            "parallel_calls_count": 1
                        },
                        "raw_response": str(response),
                        # New cost tracking fields
                        "token_usage": {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "total_tokens": input_tokens + output_tokens
                        },
                        "cost_usd": cost_usd
                    }
                else:
                    # Multiple parallel function calls
                    return {
                        "function_calls": function_calls,
                        "metadata": {
                            "processing_time_ms": processing_time,
                            "ai_model_used": model_params.get('model_name', 'unknown'),
                            "response_type": "parallel_function_calls",
                            "parallel_calls_count": len(function_calls)
                        },
                        "raw_response": str(response),
                        # New cost tracking fields
                        "token_usage": {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "total_tokens": input_tokens + output_tokens
                        },
                        "cost_usd": cost_usd
                    }
            elif text_responses:
                # Text response(s) only
                combined_text = " ".join(text_responses)
                return {
                    "text_response": combined_text,
                    "metadata": {
                        "processing_time_ms": processing_time,
                        "ai_model_used": model_params.get('model_name', 'unknown'),
                        "response_type": "text"
                    },
                    "raw_response": response,
                    # New cost tracking fields
                    "token_usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": input_tokens + output_tokens
                    },
                    "cost_usd": cost_usd
                }
            else:
                raise Exception("No function calls or text found in any parts")
                
        except Exception as e:
            raise Exception(f"Failed to parse native function response: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Gemini API connection"""
        try:
            test_prompt = "Respond with: Connection successful"
            response = self.model.generate_content(test_prompt)
            return {
                "status": "connected",
                "model": self.model_name,
                "response": response.text[:100]
            }
        except Exception as e:
            return {
                "status": "error",
                "model": self.model_name,
                "error": str(e)
            }