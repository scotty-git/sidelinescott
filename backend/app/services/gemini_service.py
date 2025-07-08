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
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.core.config import settings

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
            "response_mime_type": "application/json",
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
            # Use custom model parameters if provided
            if model_params:
                # Create a custom generation config for this request
                custom_config = {
                    "temperature": model_params.get("temperature", 0.1),
                    "top_p": model_params.get("top_p", 0.8),
                    "top_k": model_params.get("top_k", 40),
                    "max_output_tokens": model_params.get("max_tokens", 2048),
                    "response_mime_type": "application/json",
                }
                
                # Create temporary model with custom config
                custom_model = genai.GenerativeModel(
                    model_name=self.model_name,
                    generation_config=custom_config,
                    safety_settings=self.safety_settings
                )
                response = custom_model.generate_content(prompt)
                logger.info(f"Using custom model params: {custom_config}")
            else:
                # Use default model
                response = self.model.generate_content(prompt)
            
            # Parse JSON response
            result = json.loads(response.text)
            
            processing_time = round((time.time() - start_time) * 1000, 2)
            
            # Ensure required fields are present
            cleaned_response = {
                "cleaned_text": result.get("cleaned_text", raw_text),
                "metadata": {
                    "confidence_score": result.get("confidence_score", "MEDIUM"),
                    "cleaning_applied": result.get("cleaning_applied", True),
                    "cleaning_level": cleaning_level,
                    "corrections": result.get("corrections", []),
                    "context_detected": result.get("context_detected", "business_conversation"),
                    "processing_time_ms": processing_time,
                    "ai_model_used": self.model_name
                },
                "raw_response": response.text  # Store the raw Gemini response
            }
            
            logger.info(f"Cleaned in {processing_time}ms, confidence: {cleaned_response['metadata']['confidence_score']}")
            return cleaned_response
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            return self._fallback_response(raw_text, start_time)
        except Exception as e:
            logger.error(f"Gemini cleaning failed: {e}")
            return self._fallback_response(raw_text, start_time)
    
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

Return ONLY valid JSON in this exact format:
{{
    "cleaned_text": "corrected text here",
    "confidence_score": "HIGH|MEDIUM|LOW",
    "cleaning_applied": true,
    "corrections": [
        {{"original": "original text", "corrected": "corrected text", "confidence": "HIGH|MEDIUM|LOW", "reason": "explanation"}}
    ],
    "context_detected": "business_conversation|casual_chat|technical_discussion"
}}

IMPORTANT: 
- If text needs no cleaning, set cleaning_applied: false and return original text
- Be conservative - when in doubt, preserve original meaning
- Focus on making speech clear while maintaining authenticity"""

        return prompt
    
    def _fallback_response(self, raw_text: str, start_time: float) -> Dict[str, Any]:
        """Generate fallback response when Gemini fails"""
        return {
            "cleaned_text": raw_text,
            "metadata": {
                "confidence_score": "LOW",
                "cleaning_applied": False,
                "cleaning_level": "none",
                "corrections": [],
                "context_detected": "fallback",
                "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                "ai_model_used": "fallback"
            }
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