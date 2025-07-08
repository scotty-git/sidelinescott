#!/usr/bin/env python3
"""
Performance comparison test for conversation cleaning optimizations.
Tests the system with and without early exit/preprocessing optimizations.
"""

import asyncio
import time
import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.services.conversation_manager import ConversationManager
from app.models.conversation import Conversation
from uuid import uuid4

# Test data from the example transcript
TEST_TURNS = [
    # Turn 1 - Lumen (should be instant bypass)
    {"speaker": "Lumen", "text": "Hey... ... ... Its"},
    
    # Turn 2 - Clean response (should trigger early exit)
    {"speaker": "User", "text": "You're coming in clean, no complaints."},
    
    # Turn 3 - Lumen (instant bypass)
    {"speaker": "Lumen", "text": "Good, glad we're connected clearly. So, just to set the stage a little... I'm Lumen, an AI demo agent from Response-Eye-Q."},
    
    # Turn 4 - Needs cleaning (missing comma)
    {"speaker": "User", "text": "Not really we're more hands on than high tech, but this is interesting."},
    
    # Turn 6 - Simple acknowledgment (should trigger early exit)
    {"speaker": "User", "text": "Yep, everything checks out."},
    
    # Turn 8 - Clean short response (should trigger preprocessing bypass)
    {"speaker": "User", "text": "I can give you a few minutes. Let's use them well."},
    
    # Turn 12 - Needs cleaning (missing punctuation)
    {"speaker": "User", "text": "It's accurate our goal is to be first to show up and first to fix."},
    
    # Turn 14 - Needs cleaning (STT error)
    {"speaker": "User", "text": "Google adds especially for mobile searches."},
    
    # Turn 16 - Needs heavy cleaning (multiple errors)
    {"speaker": "User", "text": "Our traffic hovers around 900 monthly visit, give or take. about Calls a month. Ca mission are still low. are still low where To improve that with the with this we design. we design. O from"},
    
    # Turn 18 - Needs cleaning (multiple STT errors)
    {"speaker": "User", "text": "Um, speed is everything for us. People don't wait around when their store front shattered or their living rooms wide open to the street. street. We try to be on site as fast as humanly possible.sible peak hours tied up on other jobs."},
    
    # Turn 20 - Simple clean response (should trigger early exit)
    {"speaker": "User", "text": "Sure ready when you are."},
    
    # Turn 22 - Very simple (should trigger early exit)
    {"speaker": "User", "text": "Sure, continuing."},
]


async def test_performance_with_optimizations(manager: ConversationManager, db: Session) -> Dict[str, Any]:
    """Test with optimizations enabled (current implementation)"""
    print("\n" + "="*60)
    print("🚀 TESTING WITH OPTIMIZATIONS ENABLED")
    print("="*60)
    
    results = []
    conversation_id = uuid4()
    
    # Create conversation (using mock user_id for testing)
    mock_user_id = uuid4()
    conv = Conversation(
        id=conversation_id, 
        user_id=mock_user_id,
        name="Performance Test With Optimizations"
    )
    try:
        db.add(conv)
        db.commit()
    except Exception as e:
        print(f"⚠️ Database error creating conversation (continuing): {e}")
        db.rollback()
    
    for i, turn in enumerate(TEST_TURNS):
        print(f"\n📍 Processing Turn {i+1}: {turn['speaker']} - \"{turn['text'][:50]}...\"")
        
        start_time = time.time()
        result = await manager.add_turn(
            conversation_id=conversation_id,
            speaker=turn['speaker'],
            raw_text=turn['text'],
            db=db,
            cleaning_level="full"
        )
        processing_time = (time.time() - start_time) * 1000
        
        results.append({
            "turn": i + 1,
            "speaker": turn['speaker'],
            "text_preview": turn['text'][:50],
            "processing_time_ms": processing_time,
            "cleaning_applied": result['metadata']['cleaning_applied'],
            "ai_model_used": result['metadata'].get('ai_model_used', 'None')
        })
        
        print(f"✅ Processed in {processing_time:.2f}ms")
    
    return results


async def test_performance_without_optimizations(manager: ConversationManager, db: Session) -> Dict[str, Any]:
    """Test without optimizations (simulate old behavior)"""
    print("\n" + "="*60)
    print("🐌 TESTING WITHOUT OPTIMIZATIONS (Simulated)")
    print("="*60)
    
    results = []
    conversation_id = uuid4()
    
    # Create conversation (using mock user_id for testing)
    mock_user_id = uuid4()
    conv = Conversation(
        id=conversation_id,
        user_id=mock_user_id,
        name="Performance Test Without Optimizations"
    )
    try:
        db.add(conv)
        db.commit()
    except Exception as e:
        print(f"⚠️ Database error creating conversation (continuing): {e}")
        db.rollback()
    
    # Temporarily disable optimizations by monkey-patching
    original_is_simple = manager._is_simple_clean_response
    original_preprocess = manager._preprocess_text
    
    # Disable optimizations
    manager._is_simple_clean_response = lambda text: False
    manager._preprocess_text = lambda text: {'needs_cleaning': True, 'reason': 'Optimizations disabled'}
    
    try:
        for i, turn in enumerate(TEST_TURNS):
            print(f"\n📍 Processing Turn {i+1}: {turn['speaker']} - \"{turn['text'][:50]}...\"")
            
            start_time = time.time()
            result = await manager.add_turn(
                conversation_id=conversation_id,
                speaker=turn['speaker'],
                raw_text=turn['text'],
                db=db,
                cleaning_level="full"
            )
            processing_time = (time.time() - start_time) * 1000
            
            results.append({
                "turn": i + 1,
                "speaker": turn['speaker'],
                "text_preview": turn['text'][:50],
                "processing_time_ms": processing_time,
                "cleaning_applied": result['metadata']['cleaning_applied'],
                "ai_model_used": result['metadata'].get('ai_model_used', 'Gemini')
            })
            
            print(f"✅ Processed in {processing_time:.2f}ms")
    finally:
        # Restore original methods
        manager._is_simple_clean_response = original_is_simple
        manager._preprocess_text = original_preprocess
    
    return results


def analyze_results(with_opt: List[Dict], without_opt: List[Dict]) -> None:
    """Analyze and display performance comparison"""
    print("\n" + "="*60)
    print("📊 PERFORMANCE COMPARISON RESULTS")
    print("="*60)
    
    # Calculate totals
    total_with_opt = sum(r['processing_time_ms'] for r in with_opt)
    total_without_opt = sum(r['processing_time_ms'] for r in without_opt)
    
    # Count AI calls
    ai_calls_with = sum(1 for r in with_opt if r['ai_model_used'] != 'None')
    ai_calls_without = sum(1 for r in without_opt if r['ai_model_used'] != 'None')
    
    print(f"\n🏃 TOTAL PROCESSING TIME:")
    print(f"  Without optimizations: {total_without_opt:.2f}ms")
    print(f"  With optimizations:    {total_with_opt:.2f}ms")
    print(f"  Improvement:           {total_without_opt - total_with_opt:.2f}ms ({((total_without_opt - total_with_opt) / total_without_opt * 100):.1f}% faster)")
    
    print(f"\n🤖 AI CALLS:")
    print(f"  Without optimizations: {ai_calls_without} calls")
    print(f"  With optimizations:    {ai_calls_with} calls")
    print(f"  Reduction:             {ai_calls_without - ai_calls_with} fewer calls ({((ai_calls_without - ai_calls_with) / ai_calls_without * 100):.1f}% reduction)")
    
    print(f"\n📈 PER-TURN ANALYSIS:")
    print(f"{'Turn':<6} {'Speaker':<10} {'Text Preview':<30} {'Without Opt':<15} {'With Opt':<15} {'Speedup':<10}")
    print("-" * 96)
    
    for i in range(len(with_opt)):
        turn = with_opt[i]['turn']
        speaker = with_opt[i]['speaker']
        preview = with_opt[i]['text_preview'][:28] + "..."
        time_without = without_opt[i]['processing_time_ms']
        time_with = with_opt[i]['processing_time_ms']
        speedup = time_without / time_with if time_with > 0 else float('inf')
        
        print(f"{turn:<6} {speaker:<10} {preview:<30} {time_without:>12.2f}ms {time_with:>12.2f}ms {speedup:>7.1f}x")
    
    print("\n🎯 BIGGEST IMPROVEMENTS:")
    improvements = []
    for i in range(len(with_opt)):
        if without_opt[i]['processing_time_ms'] > 0:
            improvement = without_opt[i]['processing_time_ms'] - with_opt[i]['processing_time_ms']
            speedup = without_opt[i]['processing_time_ms'] / with_opt[i]['processing_time_ms']
            improvements.append({
                'turn': with_opt[i]['turn'],
                'text': with_opt[i]['text_preview'],
                'improvement_ms': improvement,
                'speedup': speedup
            })
    
    improvements.sort(key=lambda x: x['improvement_ms'], reverse=True)
    
    for imp in improvements[:5]:
        print(f"  Turn {imp['turn']}: {imp['improvement_ms']:.2f}ms faster ({imp['speedup']:.1f}x speedup)")


async def main():
    """Run performance comparison tests"""
    print("🔬 CONVERSATION CLEANING PERFORMANCE TEST")
    print("Testing optimizations: Early Exit Detection + Smart Preprocessing")
    
    # Initialize manager and database
    manager = ConversationManager()
    db = SessionLocal()
    
    try:
        # Run tests
        results_with_opt = await test_performance_with_optimizations(manager, db)
        results_without_opt = await test_performance_without_optimizations(manager, db)
        
        # Analyze results
        analyze_results(results_with_opt, results_without_opt)
        
    finally:
        db.close()
    
    print("\n✅ Performance test complete!")


if __name__ == "__main__":
    asyncio.run(main())