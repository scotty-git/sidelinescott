#!/usr/bin/env python3
"""
Week 3 Real-time Testing Script

Comprehensive testing script for Week 3 real-time features:
- Message queue functionality
- Real-time endpoint performance
- WebSocket architecture preparation
- Queue metrics and monitoring

This script provides extensive console output for iteration and debugging.
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
import sys
import uuid

class Week3Tester:
    def __init__(self):
        self.base_url = "http://127.0.0.1:8000"
        self.conversation_id = None
        self.test_results = {
            'queue_tests': [],
            'performance_tests': [],
            'endpoint_tests': [],
            'errors': []
        }
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] [{level}] {message}")
        
    def log_test_result(self, test_name, duration_ms, success, details=None):
        """Log test result with performance metrics"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.log(f"{status} {test_name}: {duration_ms:.2f}ms")
        
        if details:
            for detail in details:
                self.log(f"    {detail}")
                
        result = {
            'test_name': test_name,
            'duration_ms': duration_ms,
            'success': success,
            'details': details or []
        }
        
        if 'queue' in test_name.lower():
            self.test_results['queue_tests'].append(result)
        elif 'performance' in test_name.lower():
            self.test_results['performance_tests'].append(result)
        else:
            self.test_results['endpoint_tests'].append(result)
    
    async def test_backend_health(self):
        """Test backend connectivity and health"""
        self.log("=== Testing Backend Health ===")
        
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/health") as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        self.log_test_result("Backend Health Check", duration, True, [
                            f"Status: {data.get('status', 'unknown')}",
                            f"Database: {data.get('database', 'unknown')}",
                            f"Environment: {data.get('environment', 'unknown')}"
                        ])
                        return True
                    else:
                        self.log_test_result("Backend Health Check", duration, False, [
                            f"HTTP {response.status}: {response.reason}"
                        ])
                        return False
                        
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            self.log_test_result("Backend Health Check", duration, False, [str(e)])
            return False
    
    async def create_test_conversation(self):
        """Create a test conversation for Week 3 testing"""
        self.log("=== Creating Test Conversation ===")
        
        start_time = time.time()
        try:
            conversation_data = {
                "name": f"Week 3 Real-time Test - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "description": "Automated testing of Week 3 real-time features"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/v1/conversations",
                    json=conversation_data,
                    headers={"Authorization": "Bearer fake-token"}
                ) as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if response.status in [200, 201]:
                        data = await response.json()
                        self.conversation_id = data.get('id')
                        
                        self.log_test_result("Create Test Conversation", duration, True, [
                            f"Conversation ID: {self.conversation_id}",
                            f"Name: {data.get('name', 'unknown')}"
                        ])
                        return True
                    else:
                        self.log_test_result("Create Test Conversation", duration, False, [
                            f"HTTP {response.status}: {response.reason}"
                        ])
                        return False
                        
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            self.log_test_result("Create Test Conversation", duration, False, [str(e)])
            return False
    
    async def test_queue_worker_startup(self):
        """Test starting queue workers"""
        self.log("=== Testing Queue Worker Startup ===")
        
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/v1/conversations/queue/start",
                    headers={"Authorization": "Bearer fake-token"}
                ) as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        self.log_test_result("Queue Worker Startup", duration, True, [
                            f"Success: {data.get('success', False)}",
                            f"Worker Count: {data.get('worker_count', 0)}",
                            f"Message: {data.get('message', 'No message')}"
                        ])
                        return True
                    else:
                        self.log_test_result("Queue Worker Startup", duration, False, [
                            f"HTTP {response.status}: {response.reason}"
                        ])
                        return False
                        
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            self.log_test_result("Queue Worker Startup", duration, False, [str(e)])
            return False
    
    async def test_realtime_turn_processing(self, speaker, text, test_name):
        """Test real-time turn processing endpoint"""
        if not self.conversation_id:
            self.log("❌ No conversation ID available for turn processing")
            return False
            
        self.log(f"=== Testing Real-time Turn Processing: {test_name} ===")
        
        start_time = time.time()
        try:
            turn_data = {
                "speaker": speaker,
                "raw_text": text
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/v1/conversations/{self.conversation_id}/turns/realtime",
                    json=turn_data,
                    headers={"Authorization": "Bearer fake-token"}
                ) as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        
                        # Check if this meets Week 3 targets
                        meets_target = duration < 100  # <100ms for queuing
                        
                        self.log_test_result(f"Real-time Turn Processing ({test_name})", duration, meets_target, [
                            f"Queue Time: {data.get('queue_time_ms', 0):.2f}ms",
                            f"Job ID: {data.get('job_id', 'unknown')}",
                            f"Priority: {data.get('priority', 'unknown')} ({'Lumen Bypass' if speaker == 'Lumen' else 'User Processing'})",
                            f"Target: <100ms ({'✅ MET' if meets_target else '❌ MISSED'})"
                        ])
                        
                        return meets_target
                    else:
                        self.log_test_result(f"Real-time Turn Processing ({test_name})", duration, False, [
                            f"HTTP {response.status}: {response.reason}"
                        ])
                        return False
                        
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            self.log_test_result(f"Real-time Turn Processing ({test_name})", duration, False, [str(e)])
            return False
    
    async def test_queue_status(self):
        """Test queue status endpoint"""
        if not self.conversation_id:
            self.log("❌ No conversation ID available for queue status")
            return False
            
        self.log("=== Testing Queue Status ===")
        
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/v1/conversations/{self.conversation_id}/queue/status",
                    headers={"Authorization": "Bearer fake-token"}
                ) as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        metrics = data.get('queue_metrics', {})
                        
                        self.log_test_result("Queue Status Check", duration, True, [
                            f"Queue Length: {metrics.get('queue_length', 0)}",
                            f"Total Jobs: {metrics.get('total_jobs', 0)}",
                            f"Processed Jobs: {metrics.get('processed_jobs', 0)}",
                            f"Failed Jobs: {metrics.get('failed_jobs', 0)}",
                            f"Worker Count: {metrics.get('worker_count', 0)}",
                            f"Avg Processing Time: {metrics.get('avg_processing_time_ms', 0):.2f}ms"
                        ])
                        return True
                    else:
                        self.log_test_result("Queue Status Check", duration, False, [
                            f"HTTP {response.status}: {response.reason}"
                        ])
                        return False
                        
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            self.log_test_result("Queue Status Check", duration, False, [str(e)])
            return False
    
    async def run_week3_test_suite(self):
        """Run comprehensive Week 3 test suite"""
        self.log("🚀 Starting Week 3 Real-time Test Suite")
        self.log("=" * 60)
        
        # Test backend health
        if not await self.test_backend_health():
            self.log("❌ Backend health check failed, aborting tests")
            return False
        
        # Create test conversation
        if not await self.create_test_conversation():
            self.log("❌ Failed to create test conversation, aborting tests")
            return False
        
        # Start queue workers
        if not await self.test_queue_worker_startup():
            self.log("❌ Failed to start queue workers, aborting tests")
            return False
        
        # Wait a moment for workers to initialize
        self.log("⏳ Waiting 2 seconds for workers to initialize...")
        await asyncio.sleep(2)
        
        # Test real-time turn processing with various scenarios
        week3_test_cases = [
            ("User", "I am the vector of Marketing", "STT Error Pattern"),
            ("Lumen", "I understand you work in Marketing.", "Lumen Bypass Test"),
            ("User", "Yes we use book marketing strategies", "Multiple STT Errors"),
            ("User", "Yes", "Simple Acknowledgment"),
            ("User", "We have seventy five employees", "Number Conversion"),
        ]
        
        successful_tests = 0
        total_tests = len(week3_test_cases)
        
        for speaker, text, test_name in week3_test_cases:
            if await self.test_realtime_turn_processing(speaker, text, test_name):
                successful_tests += 1
            
            # Wait between tests to see queue processing
            await asyncio.sleep(1)
        
        # Check final queue status
        await self.test_queue_status()
        
        # Generate final report
        await self.generate_final_report(successful_tests, total_tests)
        
        return successful_tests == total_tests
    
    async def generate_final_report(self, successful_tests, total_tests):
        """Generate comprehensive test report"""
        self.log("=" * 60)
        self.log("📊 WEEK 3 REAL-TIME TEST SUITE RESULTS")
        self.log("=" * 60)
        
        # Overall success rate
        success_rate = (successful_tests / total_tests) * 100 if total_tests > 0 else 0
        self.log(f"Overall Success Rate: {success_rate:.1f}% ({successful_tests}/{total_tests})")
        
        # Performance summary
        all_tests = (self.test_results['queue_tests'] + 
                    self.test_results['performance_tests'] + 
                    self.test_results['endpoint_tests'])
        
        if all_tests:
            successful_tests_list = [t for t in all_tests if t['success']]
            avg_duration = sum(t['duration_ms'] for t in successful_tests_list) / len(successful_tests_list) if successful_tests_list else 0
            max_duration = max(t['duration_ms'] for t in all_tests) if all_tests else 0
            
            self.log(f"Average Response Time: {avg_duration:.2f}ms")
            self.log(f"Maximum Response Time: {max_duration:.2f}ms")
        
        # Week 3 specific metrics
        self.log("\n🎯 Week 3 Performance Targets:")
        queue_tests = [t for t in all_tests if 'queue' in t['test_name'].lower() or 'real-time' in t['test_name'].lower()]
        
        if queue_tests:
            queue_times = [t['duration_ms'] for t in queue_tests if t['success']]
            if queue_times:
                avg_queue_time = sum(queue_times) / len(queue_times)
                max_queue_time = max(queue_times)
                
                self.log(f"  Queue Response Time: {avg_queue_time:.2f}ms avg, {max_queue_time:.2f}ms max")
                self.log(f"  Target <100ms: {'✅ MET' if max_queue_time < 100 else '❌ MISSED'}")
        
        # Error summary
        if self.test_results['errors']:
            self.log(f"\n❌ Errors ({len(self.test_results['errors'])}):")
            for error in self.test_results['errors']:
                self.log(f"  {error}")
        
        # Success criteria
        self.log("\n🏆 Week 3 Success Criteria:")
        self.log(f"  ✓ Real-time endpoint queuing <100ms")
        self.log(f"  ✓ Message queue functionality")
        self.log(f"  ✓ Queue worker management")
        self.log(f"  ✓ Performance monitoring")
        self.log(f"  ✓ Comprehensive logging and debugging")
        
        overall_success = success_rate >= 80 and (not queue_tests or max([t['duration_ms'] for t in queue_tests if t['success']], default=0) < 100)
        
        if overall_success:
            self.log("\n🎉 Week 3 Implementation: SUCCESS!")
            self.log("   Real-time architecture is ready for WebSocket integration")
        else:
            self.log("\n⚠️  Week 3 Implementation: NEEDS ATTENTION")
            self.log("   Some performance targets or functionality not met")
        
        self.log("=" * 60)

async def main():
    """Main test execution"""
    print("🧪 Week 3 Real-time Testing Script")
    print("Testing comprehensive real-time architecture for Lumen Transcript Cleaner")
    print("=" * 60)
    
    tester = Week3Tester()
    
    try:
        success = await tester.run_week3_test_suite()
        
        if success:
            print("\n✅ All Week 3 tests passed! Ready for Day 12 implementation.")
            return 0
        else:
            print("\n❌ Some Week 3 tests failed. Check logs above for details.")
            return 1
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 2
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        return 3

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))