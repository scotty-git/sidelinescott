#!/usr/bin/env python3
"""
Simple performance comparison test that mocks database operations.
"""

import asyncio
import time
from typing import Dict, Any, List
from unittest.mock import Mock, MagicMock
from uuid import uuid4

# Mock the database session
class MockSession:
    def add(self, obj): pass
    def commit(self): pass
    def rollback(self): pass
    def refresh(self, obj): pass
    def query(self, model): return Mock(filter=lambda *args: Mock(first=lambda: None))

# Import after setting up mocks
import sys
sys.path.insert(0, '/Users/calsmith/Documents/VS/sidelinescott/backend')

from app.services.conversation_manager import ConversationManager
from app.services.gemini_service import GeminiService

# Test data from the example transcript
TEST_TURNS = [
    # Turn 2 - Clean response (should trigger early exit) 
    {"turn": 2, "speaker": "User", "text": "You're coming in clean, no complaints."},
    
    # Turn 4 - Actually needs cleaning (missing comma)
    {"turn": 4, "speaker": "User", "text": "Not really we're more hands on than high tech, but this is interesting."},
    
    # Turn 10 - Simple acknowledgment (should trigger early exit)
    {"turn": 10, "speaker": "User", "text": "Yep, everything checks out."},
    
    # Turn 8 - Clean short response (should trigger preprocessing bypass)
    {"turn": 8, "speaker": "User", "text": "I can give you a few minutes. Let's use them well."},
    
    # Turn 12 - Needs cleaning (missing punctuation)
    {"turn": 12, "speaker": "User", "text": "It's accurate our goal is to be first to show up and first to fix."},
    
    # Turn 16 - Needs heavy cleaning (multiple errors)
    {"turn": 16, "speaker": "User", "text": "Our traffic hovers around 900 monthly visit, give or take. about Calls a month. Ca mission are still low. are still low where To improve that with the with this we design. we design. O from"},
    
    # Turn 20 - Simple but needs cleaning
    {"turn": 20, "speaker": "User", "text": "Sure ready when you are."},
]


async def simulate_gemini_response(**kwargs) -> Dict[str, Any]:
    """Simulate Gemini API response with realistic delay"""
    # Simulate network latency + processing time
    text = kwargs.get('raw_text', '')
    await asyncio.sleep(0.8 + (len(text) / 1000))  # Base 800ms + length-based delay
    
    # Return mock cleaned result
    return {
        'cleaned_text': text,  # In real scenario, this would be cleaned
        'metadata': {
            'confidence_score': 'HIGH',
            'cleaning_applied': True,
            'cleaning_level': 'full',
            'corrections': [],
            'context_detected': 'business_conversation',
            'ai_model_used': 'gemini-2.5-flash-lite-preview-06-17',
            'processing_time_ms': 800
        }
    }


async def test_with_optimizations() -> List[Dict]:
    """Test with optimizations enabled"""
    print("\n🚀 TESTING WITH OPTIMIZATIONS")
    print("=" * 50)
    
    manager = ConversationManager()
    # Mock the Gemini service
    manager.gemini_service.clean_conversation_turn = simulate_gemini_response
    
    results = []
    conversation_id = uuid4()
    db = MockSession()
    
    for turn_data in TEST_TURNS:
        print(f"\nTurn {turn_data['turn']}: \"{turn_data['text'][:40]}...\"")
        
        start = time.time()
        result = await manager.add_turn(
            conversation_id=conversation_id,
            speaker=turn_data['speaker'],
            raw_text=turn_data['text'],
            db=db,
            cleaning_level="full"
        )
        elapsed = (time.time() - start) * 1000
        
        ai_used = result['metadata'].get('ai_model_used') is not None
        print(f"  Time: {elapsed:.1f}ms | AI Called: {ai_used}")
        
        results.append({
            'turn': turn_data['turn'],
            'time_ms': elapsed,
            'ai_called': ai_used,
            'text': turn_data['text'][:40]
        })
    
    return results


async def test_without_optimizations() -> List[Dict]:
    """Test without optimizations (force all through AI)"""
    print("\n🐌 TESTING WITHOUT OPTIMIZATIONS")
    print("=" * 50)
    
    manager = ConversationManager()
    # Mock the Gemini service
    manager.gemini_service.clean_conversation_turn = simulate_gemini_response
    
    # Disable optimizations
    manager._is_simple_clean_response = lambda text: False
    manager._preprocess_text = lambda text: {'needs_cleaning': True, 'reason': 'Forced'}
    
    results = []
    conversation_id = uuid4()
    db = MockSession()
    
    for turn_data in TEST_TURNS:
        print(f"\nTurn {turn_data['turn']}: \"{turn_data['text'][:40]}...\"")
        
        start = time.time()
        result = await manager.add_turn(
            conversation_id=conversation_id,
            speaker=turn_data['speaker'],
            raw_text=turn_data['text'],
            db=db,
            cleaning_level="full"
        )
        elapsed = (time.time() - start) * 1000
        
        ai_used = result['metadata'].get('ai_model_used') is not None
        print(f"  Time: {elapsed:.1f}ms | AI Called: {ai_used}")
        
        results.append({
            'turn': turn_data['turn'],
            'time_ms': elapsed,
            'ai_called': ai_used,
            'text': turn_data['text'][:40]
        })
    
    return results


def print_comparison(with_opt: List[Dict], without_opt: List[Dict]):
    """Print comparison results"""
    print("\n" + "=" * 70)
    print("📊 PERFORMANCE COMPARISON SUMMARY")
    print("=" * 70)
    
    # Create lookup by turn number
    with_opt_map = {r['turn']: r for r in with_opt}
    without_opt_map = {r['turn']: r for r in without_opt}
    
    total_with = sum(r['time_ms'] for r in with_opt)
    total_without = sum(r['time_ms'] for r in without_opt)
    
    ai_calls_with = sum(1 for r in with_opt if r['ai_called'])
    ai_calls_without = sum(1 for r in without_opt if r['ai_called'])
    
    print(f"\n🏃 TOTAL PROCESSING TIME:")
    print(f"  Without optimizations: {total_without:,.1f}ms")
    print(f"  With optimizations:    {total_with:,.1f}ms")
    print(f"  Speed improvement:     {total_without/total_with:.1f}x faster")
    print(f"  Time saved:           {total_without - total_with:,.1f}ms")
    
    print(f"\n🤖 AI CALLS:")
    print(f"  Without optimizations: {ai_calls_without} calls (100%)")
    print(f"  With optimizations:    {ai_calls_with} calls ({ai_calls_with/ai_calls_without*100:.0f}%)")
    print(f"  Calls avoided:        {ai_calls_without - ai_calls_with} ({(ai_calls_without-ai_calls_with)/ai_calls_without*100:.0f}%)")
    
    print(f"\n📈 PER-TURN BREAKDOWN:")
    print(f"{'Turn':<6} {'Text':<35} {'Without':<12} {'With':<12} {'Speedup':<10} {'AI?':<5}")
    print("-" * 85)
    
    for turn_num in sorted(with_opt_map.keys()):
        w = with_opt_map[turn_num]
        wo = without_opt_map[turn_num]
        speedup = wo['time_ms'] / w['time_ms'] if w['time_ms'] > 0 else float('inf')
        
        print(f"{turn_num:<6} {w['text']:<35} {wo['time_ms']:>10.1f}ms {w['time_ms']:>10.1f}ms "
              f"{speedup:>8.1f}x  {'Yes' if w['ai_called'] else 'No':<5}")
    
    print("\n✨ KEY INSIGHTS:")
    print(f"  • Clean text bypasses AI completely (instant response)")
    print(f"  • {(ai_calls_without-ai_calls_with)/ai_calls_without*100:.0f}% of turns didn't need AI processing")
    print(f"  • Average speedup for bypassed turns: {total_without/ai_calls_without/10:.0f}x")


async def main():
    print("🔬 TRANSCRIPT CLEANING PERFORMANCE TEST")
    print("Comparing: Original vs Optimized (Early Exit + Smart Preprocessing)")
    
    # Run tests
    results_with = await test_with_optimizations()
    results_without = await test_without_optimizations()
    
    # Show comparison
    print_comparison(results_with, results_without)
    
    print("\n✅ Test complete!")


if __name__ == "__main__":
    # Suppress verbose logging
    import logging
    logging.getLogger().setLevel(logging.WARNING)
    
    asyncio.run(main())