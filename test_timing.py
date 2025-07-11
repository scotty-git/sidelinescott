#!/usr/bin/env python3
"""
Test script to verify comprehensive timing breakdown is working properly
"""

import asyncio
import requests
import json
import time

# Configuration
BASE_URL = "http://127.0.0.1:8000"
AUTH_TOKEN = "your_token_here"  # Replace with actual token if needed

async def test_timing_breakdown():
    """Test the timing breakdown functionality"""
    
    print("🧪 TIMING BREAKDOWN TEST")
    print("=" * 50)
    
    # Step 1: Get a conversation that has turns
    print("1. Getting conversations...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/conversations")
        if response.status_code != 200:
            print(f"❌ Failed to get conversations: {response.status_code}")
            return
        
        conversations = response.json()
        if not conversations or len(conversations) == 0:
            print("❌ No conversations found")
            return
        
        conversation = conversations[0]
        conversation_id = conversation['id']
        print(f"✅ Using conversation: {conversation['name']} ({conversation_id})")
        
        # Step 2: Get turns for this conversation
        print("\n2. Getting turns...")
        response = requests.get(f"{BASE_URL}/api/v1/conversations/{conversation_id}/turns")
        if response.status_code != 200:
            print(f"❌ Failed to get turns: {response.status_code}")
            return
        
        turns = response.json()
        if not turns or len(turns) == 0:
            print("❌ No turns found")
            return
        
        # Find a user turn (not Lumen)
        user_turn = None
        for turn in turns:
            if turn['speaker'] not in ['Lumen', 'AI', 'Assistant', 'Claude']:
                user_turn = turn
                break
        
        if not user_turn:
            print("❌ No user turns found")
            return
        
        print(f"✅ Using user turn: {user_turn['speaker']} - '{user_turn['raw_text'][:50]}...'")
        
        # Step 3: Create an evaluation
        print("\n3. Creating evaluation...")
        eval_data = {
            "name": "Timing Test Evaluation",
            "description": "Testing comprehensive timing breakdown",
            "settings": {
                "cleaning_level": "full",
                "sliding_window": 5
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/conversations/{conversation_id}/evaluations",
            json=eval_data
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to create evaluation: {response.status_code}")
            print(f"Response: {response.text}")
            return
        
        evaluation = response.json()
        evaluation_id = evaluation['id']
        print(f"✅ Created evaluation: {evaluation_id}")
        
        # Step 4: Process the user turn and measure timing
        print("\n4. Processing turn with timing measurement...")
        
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/api/v1/evaluations/{evaluation_id}/process-turn",
            json={"turn_id": user_turn['id']}
        )
        
        end_time = time.time()
        actual_latency = (end_time - start_time) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed to process turn: {response.status_code}")
            print(f"Response: {response.text}")
            return
        
        result = response.json()
        print(f"✅ Turn processed successfully")
        
        # Step 5: Analyze timing breakdown
        print("\n5. TIMING BREAKDOWN ANALYSIS")
        print("=" * 50)
        
        timing_breakdown = result.get('timing_breakdown', {})
        if not timing_breakdown:
            print("❌ No timing breakdown found in response")
            return
        
        print(f"📊 Actual API Latency: {actual_latency:.2f}ms")
        print(f"📊 Reported Total Time: {timing_breakdown.get('total_ms', 'N/A')}ms")
        print()
        
        # Infrastructure & Setup Analysis
        print("🏗️ INFRASTRUCTURE & SETUP:")
        infra_keys = [
            ('database_query_ms', 'Database Query'),
            ('settings_preparation_ms', 'Settings Preparation'), 
            ('context_retrieval_ms', 'Context Retrieval'),
            ('processing_decision_ms', 'Processing Decision')
        ]
        
        infra_total = 0
        for key, label in infra_keys:
            value = timing_breakdown.get(key, 0)
            infra_total += value
            status = "✅" if value > 0 else "❌"
            print(f"  {status} {label}: {value}ms")
        
        print(f"  📊 Infrastructure Total: {infra_total:.2f}ms")
        print()
        
        # Cleaning Processing Analysis
        print("🧹 CLEANING PROCESSING DETAILS:")
        cleaning_keys = [
            ('prompt_preparation_ms', 'Prompt Preparation'),
            ('gemini_api_ms', 'Gemini API ⭐'),
            ('database_save_ms', 'Database Save'),
            ('context_update_ms', 'Context Update')
        ]
        
        cleaning_total = 0
        for key, label in cleaning_keys:
            value = timing_breakdown.get(key, 0)
            cleaning_total += value
            status = "✅" if value > 0 else "❌"
            special = "🌟" if "gemini" in key.lower() else ""
            print(f"  {status} {label}: {value}ms {special}")
        
        reported_cleaning_total = timing_breakdown.get('cleaning_processing_ms', 0)
        print(f"  📊 Cleaning Details Total: {cleaning_total:.2f}ms")
        print(f"  📊 Reported Cleaning Total: {reported_cleaning_total}ms")
        print()
        
        # Overall Analysis
        print("🎯 OVERALL ANALYSIS:")
        total_accounted = infra_total + cleaning_total
        total_reported = timing_breakdown.get('total_ms', 0)
        
        print(f"  📊 Sum of all components: {total_accounted:.2f}ms")
        print(f"  📊 Reported total: {total_reported}ms")
        print(f"  📊 Actual API latency: {actual_latency:.2f}ms")
        
        # Check for reasonable values
        print("\n🔍 VALIDATION CHECKS:")
        
        # Check 1: Infrastructure components should be > 0
        infra_nonzero = sum(1 for key, _ in infra_keys if timing_breakdown.get(key, 0) > 0)
        print(f"  Infrastructure components with timing: {infra_nonzero}/{len(infra_keys)} {'✅' if infra_nonzero >= 3 else '❌'}")
        
        # Check 2: Gemini API should be the largest component for user turns
        gemini_time = timing_breakdown.get('gemini_api_ms', 0)
        print(f"  Gemini API time reasonable (>50ms): {gemini_time}ms {'✅' if gemini_time > 50 else '❌'}")
        
        # Check 3: Total should be reasonable
        total_reasonable = 100 <= total_reported <= 5000  # Between 100ms and 5s
        print(f"  Total time reasonable (100-5000ms): {total_reported}ms {'✅' if total_reasonable else '❌'}")
        
        # Check 4: Components should add up roughly to total
        component_ratio = (total_accounted / total_reported) if total_reported > 0 else 0
        components_match = 0.8 <= component_ratio <= 1.2  # Within 20%
        print(f"  Components add up to total: {component_ratio:.2f} {'✅' if components_match else '❌'}")
        
        print("\n" + "=" * 50)
        if infra_nonzero >= 3 and gemini_time > 50 and total_reasonable and components_match:
            print("🎉 TIMING BREAKDOWN TEST PASSED!")
        else:
            print("❌ TIMING BREAKDOWN TEST FAILED!")
        
        print("\n📋 Raw timing breakdown data:")
        print(json.dumps(timing_breakdown, indent=2))
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_timing_breakdown())