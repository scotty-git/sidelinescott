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
                "prompt_used": prompt  # Store the actual prompt that was sent to Gemini
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