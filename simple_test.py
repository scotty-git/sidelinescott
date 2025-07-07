#!/usr/bin/env python3
"""
Simple Week 3 Test - Quick validation of real-time features
"""

import requests
import json
import time

def test_simple():
    base_url = "http://127.0.0.1:8000"
    
    print("🧪 Simple Week 3 Test")
    print("=" * 40)
    
    # Test 1: Health check
    print("1. Testing backend health...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Health: {response.status_code} - {response.json().get('status', 'unknown')}")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return
    
    # Test 2: Start queue workers
    print("2. Starting queue workers...")
    try:
        response = requests.post(
            f"{base_url}/api/v1/conversations/queue/start",
            headers={"Authorization": "Bearer fake-token"},
            timeout=10
        )
        result = response.json()
        print(f"   Workers: {response.status_code} - {result.get('worker_count', 0)} workers started")
    except Exception as e:
        print(f"   ❌ Queue startup failed: {e}")
        return
    
    # Test 3: Create conversation
    print("3. Creating test conversation...")
    try:
        conv_data = {
            "name": "Simple Test Conversation",
            "description": "Quick test"
        }
        response = requests.post(
            f"{base_url}/api/v1/conversations",
            json=conv_data,
            headers={"Authorization": "Bearer fake-token"},
            timeout=10
        )
        conv_result = response.json()
        conversation_id = conv_result.get('id')
        print(f"   Conversation: {response.status_code} - ID: {conversation_id}")
    except Exception as e:
        print(f"   ❌ Conversation creation failed: {e}")
        return
    
    if not conversation_id:
        print("   ❌ No conversation ID received")
        return
    
    # Test 4: Real-time turn processing
    print("4. Testing real-time turn processing...")
    try:
        turn_data = {
            "speaker": "User",
            "raw_text": "I am the vector of Marketing"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/v1/conversations/{conversation_id}/turns/realtime",
            json=turn_data,
            headers={"Authorization": "Bearer fake-token"},
            timeout=10
        )
        queue_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Turn queued in {queue_time:.2f}ms")
            print(f"   Job ID: {result.get('job_id', 'unknown')}")
            print(f"   Priority: {result.get('priority', 'unknown')}")
            
            # Check if meets target
            if queue_time < 100:
                print(f"   🎯 Performance target MET (<100ms)")
            else:
                print(f"   ⚠️ Performance target MISSED (>100ms)")
        else:
            print(f"   ❌ Turn processing failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Real-time processing failed: {e}")
        return
    
    # Test 5: Queue status
    print("5. Checking queue status...")
    try:
        response = requests.get(
            f"{base_url}/api/v1/conversations/{conversation_id}/queue/status",
            headers={"Authorization": "Bearer fake-token"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            metrics = result.get('queue_metrics', {})
            print(f"   ✅ Queue status retrieved")
            print(f"   Total jobs: {metrics.get('total_jobs', 0)}")
            print(f"   Workers: {metrics.get('worker_count', 0)}")
        else:
            print(f"   ❌ Queue status failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Queue status check failed: {e}")
    
    print("\n🎉 Simple Week 3 test completed!")
    print("📡 Backend: http://127.0.0.1:8000")
    print("🌐 Frontend: http://127.0.0.1:6174/week3")

if __name__ == "__main__":
    test_simple()