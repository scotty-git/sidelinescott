#!/usr/bin/env python3
"""
Test script to validate timing improvements in the evaluation system.

This script will:
1. Create a test evaluation with a simple prompt
2. Process a few turns
3. Analyze the timing breakdown to ensure proper separation
4. Report on timing accuracy
"""

import asyncio
import json
import time
from datetime import datetime
import requests

# Configuration
API_BASE = "http://127.0.0.1:8000"
AUTH_TOKEN = None  # Will be set after login

# Test credentials (from CLAUDE.md)
TEST_EMAIL = "eval@lumenarc.ai"
TEST_PASSWORD = "@Evalaccount1"


def login():
    """Login and get auth token"""
    global AUTH_TOKEN
    
    response = requests.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        AUTH_TOKEN = data.get("access_token")
        print(f"✅ Logged in successfully")
        return True
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return False


def get_headers():
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }


def create_test_conversation():
    """Create a test conversation"""
    response = requests.post(
        f"{API_BASE}/api/v1/conversations",
        headers=get_headers(),
        json={
            "name": f"Timing Test - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Testing timing improvements"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Created conversation: {data['id']}")
        return data['id']
    else:
        print(f"❌ Failed to create conversation: {response.text}")
        return None


def parse_test_transcript(conversation_id):
    """Parse a test transcript with mixed turns"""
    test_transcript = """User: Hey there, can you help me understand how to optimize my React application? It's been running really slowly lately.
    
Lumen: I'd be happy to help you optimize your React application. Performance issues can stem from various sources. Let me guide you through some common optimization strategies.

User: That sounds great! I think the main issue is with rendering, especially when I have long lists of items.

Lumen: For long lists in React, virtualization is often the best solution. Consider using libraries like react-window or react-virtualized to render only visible items.

User: Interesting! What about state management? I'm using Redux and I wonder if that's causing issues.

Lumen: Redux can impact performance if not used correctly. Make sure you're using proper memoization with useSelector and consider using Redux Toolkit for better performance defaults."""
    
    response = requests.post(
        f"{API_BASE}/api/v1/conversations/{conversation_id}/parse-transcript",
        headers=get_headers(),
        json={"raw_transcript": test_transcript}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Parsed transcript: {data['turns_created']} turns created")
        return True
    else:
        print(f"❌ Failed to parse transcript: {response.text}")
        return False


def create_test_evaluation(conversation_id):
    """Create a test evaluation with timing-focused settings"""
    response = requests.post(
        f"{API_BASE}/api/v1/evaluations/conversations/{conversation_id}/evaluations",
        headers=get_headers(),
        json={
            "name": "Timing Test Evaluation",
            "description": "Testing timing improvements",
            "prompt_template": """Clean the following text from a conversation:

Raw text: {raw_text}

Context:
{conversation_context}

Instructions:
- Fix speech-to-text errors
- Remove filler words
- Maintain original meaning
- Keep technical terms accurate

Return only the cleaned text.""",
            "settings": {
                "cleaning_level": "full",
                "sliding_window": 5,
                "model_params": {
                    "temperature": 0.1,
                    "max_tokens": 1024
                }
            }
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Created evaluation: {data['id']}")
        return data['id']
    else:
        print(f"❌ Failed to create evaluation: {response.text}")
        return None


def process_all_turns(evaluation_id):
    """Process all turns and analyze timing"""
    print(f"\n🚀 Processing all turns...")
    
    response = requests.post(
        f"{API_BASE}/api/v1/evaluations/{evaluation_id}/process-all",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Processing complete: {data['processed_successfully']}/{data['total_turns']} turns")
        return True
    else:
        print(f"❌ Processing failed: {response.text}")
        return False


def analyze_timing_results(evaluation_id):
    """Get evaluation details and analyze timing breakdown"""
    print(f"\n🔍 Analyzing timing results...")
    
    response = requests.get(
        f"{API_BASE}/api/v1/evaluations/{evaluation_id}",
        headers=get_headers()
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get evaluation details: {response.text}")
        return
    
    data = response.json()
    cleaned_turns = data.get('cleaned_turns', [])
    
    print(f"\n📊 TIMING ANALYSIS RESULTS")
    print(f"="*60)
    
    # Analyze each turn
    user_turns = []
    lumen_turns = []
    
    for turn in cleaned_turns:
        timing = turn.get('timing_breakdown', {})
        is_user = turn.get('raw_speaker') not in ['Lumen', 'AI', 'Assistant']
        
        if is_user:
            user_turns.append(timing)
        else:
            lumen_turns.append(timing)
    
    # User turn analysis
    if user_turns:
        print(f"\n👤 USER TURNS ANALYSIS ({len(user_turns)} turns):")
        print(f"-"*40)
        
        for i, timing in enumerate(user_turns, 1):
            print(f"\nTurn {i}:")
            print(f"  Total Time: {timing.get('total_ms', 0):.2f}ms")
            
            # Check for new granular timing
            if 'gemini_network_ms' in timing:
                print(f"  ✅ NEW TIMING FOUND:")
                print(f"     - Prompt Preparation: {timing.get('prompt_preparation_ms', 0):.2f}ms")
                print(f"     - PURE Gemini Network: {timing.get('gemini_network_ms', 0):.2f}ms 🎯")
                print(f"     - Response Parsing: {timing.get('response_parsing_ms', 0):.2f}ms")
                print(f"     - Total Gemini Call: {timing.get('gemini_api_ms', 0):.2f}ms")
                
                # Calculate overhead
                overhead = timing.get('gemini_api_ms', 0) - timing.get('gemini_network_ms', 0)
                print(f"     - Processing Overhead: {overhead:.2f}ms")
            else:
                print(f"  ⚠️ OLD TIMING (no granular breakdown):")
                print(f"     - Gemini API: {timing.get('gemini_api_ms', 0):.2f}ms")
            
            # Database timing breakdown
            if 'db_queries_breakdown' in timing:
                print(f"  🗄️ Database Breakdown:")
                db_breakdown = timing['db_queries_breakdown']
                for query, time_ms in db_breakdown.items():
                    if time_ms > 0:
                        print(f"     - {query}: {time_ms:.2f}ms")
    
    # Lumen turn analysis
    if lumen_turns:
        print(f"\n🤖 LUMEN TURNS ANALYSIS ({len(lumen_turns)} turns):")
        print(f"-"*40)
        
        avg_time = sum(t.get('total_ms', 0) for t in lumen_turns) / len(lumen_turns)
        print(f"  Average Processing Time: {avg_time:.2f}ms")
        print(f"  (Should be <50ms for bypass)")
    
    # Summary
    print(f"\n🎯 SUMMARY:")
    print(f"="*60)
    
    if user_turns and any('gemini_network_ms' in t for t in user_turns):
        print(f"✅ New timing implementation detected!")
        
        # Calculate averages for user turns
        avg_prompt_prep = sum(t.get('prompt_preparation_ms', 0) for t in user_turns) / len(user_turns)
        avg_gemini_pure = sum(t.get('gemini_network_ms', 0) for t in user_turns if 'gemini_network_ms' in t) / len([t for t in user_turns if 'gemini_network_ms' in t])
        avg_total = sum(t.get('total_ms', 0) for t in user_turns) / len(user_turns)
        
        print(f"\nAverage User Turn Timing:")
        print(f"  - Prompt Preparation: {avg_prompt_prep:.2f}ms")
        print(f"  - PURE Gemini API: {avg_gemini_pure:.2f}ms")
        print(f"  - Total Processing: {avg_total:.2f}ms")
        
        overhead_percent = ((avg_total - avg_gemini_pure) / avg_total) * 100
        print(f"\nOverhead Analysis:")
        print(f"  - Non-API overhead: {overhead_percent:.1f}% of total time")
        print(f"  - This represents {avg_total - avg_gemini_pure:.2f}ms of overhead")
    else:
        print(f"❌ Old timing implementation detected - no granular breakdown available")


def main():
    """Run the timing test"""
    print("🚀 TIMING IMPROVEMENT TEST")
    print("=" * 60)
    
    # Step 1: Login
    if not login():
        return
    
    # Step 2: Create test conversation
    conversation_id = create_test_conversation()
    if not conversation_id:
        return
    
    # Step 3: Parse test transcript
    if not parse_test_transcript(conversation_id):
        return
    
    # Step 4: Create evaluation
    evaluation_id = create_test_evaluation(conversation_id)
    if not evaluation_id:
        return
    
    # Step 5: Process all turns
    time.sleep(1)  # Give the system a moment
    if not process_all_turns(evaluation_id):
        return
    
    # Step 6: Analyze timing
    time.sleep(2)  # Wait for processing to complete
    analyze_timing_results(evaluation_id)
    
    print(f"\n✅ Test complete!")
    print(f"\nView detailed results at:")
    print(f"  http://127.0.0.1:6173/evaluation/{evaluation_id}")


if __name__ == "__main__":
    main()