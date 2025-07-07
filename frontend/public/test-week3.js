// Week 3 Real-time Manual Test Script
// Run this in browser console at http://127.0.0.1:6174/week3

console.log('🧪 Week 3 Real-time Manual Test Script');
console.log('Testing backend connectivity and queue system...');

async function testWeek3Manual() {
  const baseUrl = 'http://127.0.0.1:8000';
  
  try {
    // Test 1: Health check
    console.log('\n1. Testing backend health...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health:', healthData.status);
    
    // Test 2: Start queue workers
    console.log('\n2. Starting queue workers...');
    const startResponse = await fetch(`${baseUrl}/api/v1/conversations/queue/start`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake-token',
        'Content-Type': 'application/json'
      }
    });
    const startData = await startResponse.json();
    console.log('✅ Queue workers:', startData.worker_count, 'workers');
    
    // Test 3: Create conversation
    console.log('\n3. Creating test conversation...');
    const convResponse = await fetch(`${baseUrl}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Manual Test Conversation',
        description: 'Quick manual test'
      })
    });
    const convData = await convResponse.json();
    console.log('✅ Conversation created:', convData.id);
    
    // Test 4: Queue a turn for real-time processing
    console.log('\n4. Testing real-time turn processing...');
    const start = performance.now();
    const turnResponse = await fetch(`${baseUrl}/api/v1/conversations/${convData.id}/turns/realtime`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        speaker: 'User',
        raw_text: 'I am the vector of Marketing'
      })
    });
    const turnData = await turnResponse.json();
    const queueTime = performance.now() - start;
    
    console.log('✅ Turn queued in', queueTime.toFixed(2), 'ms');
    console.log('   Job ID:', turnData.job_id);
    console.log('   Priority:', turnData.priority);
    
    if (queueTime < 100) {
      console.log('🎯 Performance target MET (<100ms)');
    } else {
      console.log('⚠️ Performance target MISSED (>100ms)');
    }
    
    // Test 5: Check queue status
    console.log('\n5. Checking queue status...');
    const statusResponse = await fetch(`${baseUrl}/api/v1/conversations/${convData.id}/queue/status`, {
      headers: {
        'Authorization': 'Bearer fake-token'
      }
    });
    const statusData = await statusResponse.json();
    const metrics = statusData.queue_metrics;
    
    console.log('✅ Queue status:');
    console.log('   Total jobs:', metrics.total_jobs);
    console.log('   Processed:', metrics.processed_jobs);
    console.log('   Workers:', metrics.worker_count);
    
    console.log('\n🎉 Week 3 manual test completed successfully!');
    console.log('🔗 Frontend: http://127.0.0.1:6174/week3');
    console.log('🔗 Backend: http://127.0.0.1:8000');
    
    return {
      conversationId: convData.id,
      queueTime,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
    return { success: false, error: error.message };
  }
}

// Auto-run the test
testWeek3Manual();