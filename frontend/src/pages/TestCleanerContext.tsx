import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface TurnData {
  speaker: string;
  raw_text: string;
  cleaned_text?: string;
  metadata?: {
    confidence_score: string;
    cleaning_applied: boolean;
    cleaning_level: string;
    processing_time_ms: number;
    corrections: any[];
    context_detected: string;
  };
  created_at?: string;
}

interface ConversationContext {
  conversation_id: string;
  current_context: TurnData[];
  context_patterns: any;
  total_history_length: number;
}

export const TestCleanerContext: React.FC = () => {
  const [conversationId, setConversationId] = useState<string>('');
  const [speaker, setSpeaker] = useState<string>('User');
  const [rawText, setRawText] = useState<string>('');
  const [turns, setTurns] = useState<TurnData[]>([]);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(`[TestPage] ${timestamp}: ${message}`);
  };

  // Test cases for CleanerContext
  const testCases = [
    { speaker: 'User', text: 'I am the vector of Marketing', description: 'STT Error Pattern' },
    { speaker: 'Lumen', text: 'I understand you work in Marketing.', description: 'Lumen Response (should bypass)' },
    { speaker: 'User', text: 'Yes, we use book marketing strategies', description: 'Another STT Error' },
    { speaker: 'User', text: 'Our customers love are product', description: 'Grammar Error' },
    { speaker: 'User', text: 'Yes', description: 'Simple Acknowledgment (should skip cleaning)' },
    { speaker: 'Lumen', text: 'That makes sense for your business.', description: 'Another Lumen Response' },
    { speaker: 'User', text: 'We have good results this quarter', description: 'Clean Text (light cleaning)' }
  ];

  const createTestConversation = async () => {
    try {
      addLog('Creating test conversation...');
      const response = await apiClient.createConversation(
        'CleanerContext Test Conversation',
        'Testing stateful conversation cleaning with CleanerContext'
      );
      setConversationId(response.id);
      addLog(`✅ Test conversation created: ${response.id}`);
    } catch (error) {
      addLog(`❌ Failed to create conversation: ${error}`);
    }
  };

  const processTurn = async (testSpeaker?: string, testText?: string) => {
    if (!conversationId) {
      addLog('❌ No conversation selected');
      return;
    }

    const turnSpeaker = testSpeaker || speaker;
    const turnText = testText || rawText;

    if (!turnText.trim()) {
      addLog('❌ No text to process');
      return;
    }

    setIsProcessing(true);
    addLog(`🚀 Processing ${turnSpeaker} turn: "${turnText}"`);

    try {
      const startTime = Date.now();
      
      const response = await fetch(`http://127.0.0.1:8000/api/v1/conversations/${conversationId}/turns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-token' // For testing without auth
        },
        body: JSON.stringify({
          speaker: turnSpeaker,
          raw_text: turnText
        })
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      addLog(`✅ Turn processed in ${totalTime.toFixed(2)}ms`);
      addLog(`   Processing time: ${result.metadata.processing_time_ms}ms`);
      addLog(`   Cleaning applied: ${result.metadata.cleaning_applied}`);
      addLog(`   Confidence: ${result.metadata.confidence_score}`);
      addLog(`   Cleaning level: ${result.metadata.cleaning_level}`);
      
      if (result.metadata.corrections.length > 0) {
        addLog(`   Corrections: ${result.metadata.corrections.length}`);
        result.metadata.corrections.forEach((correction: any, index: number) => {
          addLog(`     ${index + 1}. "${correction.original}" → "${correction.corrected}" (${correction.confidence})`);
        });
      }

      setTurns(prev => [...prev, result]);
      setRawText('');

      // Refresh context and performance
      await loadContext();
      await loadPerformance();

    } catch (error) {
      addLog(`❌ Turn processing failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadContext = async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/conversations/${conversationId}/context`, {
        headers: {
          'Authorization': 'Bearer fake-token'
        }
      });

      if (response.ok) {
        const contextData = await response.json();
        setContext(contextData);
        addLog(`📊 Context loaded: ${contextData.current_context.length} turns in sliding window`);
      }
    } catch (error) {
      addLog(`❌ Failed to load context: ${error}`);
    }
  };

  const loadPerformance = async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/conversations/${conversationId}/performance`, {
        headers: {
          'Authorization': 'Bearer fake-token'
        }
      });

      if (response.ok) {
        const perfData = await response.json();
        setPerformance(perfData);
        addLog(`⚡ Performance metrics updated`);
      }
    } catch (error) {
      addLog(`❌ Failed to load performance: ${error}`);
    }
  };

  const runAllTestCases = async () => {
    addLog('🧪 Running all test cases...');
    
    for (const testCase of testCases) {
      addLog(`\n--- Testing: ${testCase.description} ---`);
      await processTurn(testCase.speaker, testCase.text);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
    }
    
    addLog('\n🎉 All test cases completed!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CleanerContext Testing Page</h1>
          <p className="text-gray-600 mb-4">
            Test the stateful conversation cleaning system with intelligent turn processing
          </p>
          
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <button
                onClick={createTestConversation}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mb-2"
              >
                Create Test Conversation
              </button>
              
              {conversationId && (
                <p className="text-sm text-gray-600">
                  Conversation ID: <code className="bg-gray-100 px-2 py-1 rounded">{conversationId}</code>
                </p>
              )}
            </div>
            
            <div>
              <button
                onClick={runAllTestCases}
                disabled={!conversationId || isProcessing}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                Run All Test Cases
              </button>
            </div>
          </div>

          {/* Manual Turn Input */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Manual Turn Processing</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaker</label>
                <select
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="User">User</option>
                  <option value="Lumen">Lumen</option>
                  <option value="AI">AI</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Raw Text</label>
                <input
                  type="text"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Enter text to process..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  onKeyPress={(e) => e.key === 'Enter' && processTurn()}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => processTurn()}
                  disabled={!conversationId || isProcessing || !rawText.trim()}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {isProcessing ? 'Processing...' : 'Process Turn'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Test Cases Reference */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3">Test Cases</h3>
            <div className="space-y-2">
              {testCases.map((testCase, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-3 py-1">
                  <div className="font-medium text-sm">{testCase.description}</div>
                  <div className="text-xs text-gray-600">
                    {testCase.speaker}: "{testCase.text}"
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          {performance && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Performance Metrics</h3>
              <div className="space-y-2">
                {Object.entries(performance.performance_metrics).map(([key, metrics]: [string, any]) => (
                  <div key={key} className="text-sm">
                    <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                    <div className="text-gray-600 ml-2">
                      Avg: {metrics.avg_ms?.toFixed(2)}ms | 
                      Max: {metrics.max_ms?.toFixed(2)}ms | 
                      Count: {metrics.count}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-3 pt-3 border-t">
                <h4 className="font-medium text-sm mb-2">Targets</h4>
                <div className="text-xs text-gray-600">
                  <div>Lumen: &lt;{performance.targets.lumen_processing_ms}ms</div>
                  <div>User: &lt;{performance.targets.user_processing_ms}ms</div>
                  <div>Context: &lt;{performance.targets.context_retrieval_ms}ms</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conversation History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3">Conversation History</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-l-4 ${
                    turn.speaker === 'Lumen' || turn.speaker === 'AI'
                      ? 'border-green-500 bg-green-50'
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{turn.speaker}</span>
                    {turn.metadata && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        turn.metadata.confidence_score === 'HIGH' ? 'bg-green-200 text-green-800' :
                        turn.metadata.confidence_score === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-red-200 text-red-800'
                      }`}>
                        {turn.metadata.confidence_score}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-700 mb-1">
                    <strong>Raw:</strong> {turn.raw_text}
                  </div>
                  
                  {turn.cleaned_text && turn.cleaned_text !== turn.raw_text && (
                    <div className="text-sm text-gray-700 mb-1">
                      <strong>Cleaned:</strong> {turn.cleaned_text}
                    </div>
                  )}
                  
                  {turn.metadata && (
                    <div className="text-xs text-gray-500 mt-2">
                      {turn.metadata.cleaning_applied ? '🧹' : '⏭️'} {turn.metadata.cleaning_level} | 
                      ⚡ {turn.metadata.processing_time_ms}ms |
                      🎯 {turn.metadata.context_detected} |
                      ✏️ {turn.metadata.corrections.length} corrections
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sliding Window Context */}
          {context && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">
                Sliding Window Context ({context.current_context.length}/{context.total_history_length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {context.current_context.map((turn, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="font-medium">{turn.speaker}</div>
                    <div className="text-gray-700">{turn.cleaned_text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debug Logs */}
        <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
          <h3 className="text-white font-bold mb-2">Debug Logs</h3>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};