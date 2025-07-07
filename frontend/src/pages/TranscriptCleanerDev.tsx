import React, { useState, useRef } from 'react'
import { apiClient } from '../lib/api'

interface ParsedTurn {
  speaker: string
  raw_text: string
  turn_index: number
  original_speaker_label: string
  vt_tags: string[]
  has_noise: boolean
  has_foreign_text: boolean
}

interface CleanedTurn {
  turn_id: string
  conversation_id: string
  speaker: string
  raw_text: string
  cleaned_text: string
  metadata: {
    confidence_score: string
    cleaning_applied: boolean
    cleaning_level: string
    corrections: Array<{
      original: string
      corrected: string
      confidence: string
      reason: string
    }>
    context_detected: string
    processing_time_ms: number
    ai_model_used: string
  }
  created_at: string
}

interface APICall {
  id: string
  timestamp: string
  method: string
  endpoint: string
  request_data: any
  response_data: any
  status: number
  latency_ms: number
  error?: string
}

interface ProcessingStats {
  total_turns: number
  user_turns: number
  lumen_turns: number
  turns_with_noise: number
  turns_with_foreign_text: number
  avg_turn_length_chars: number
}

export function TranscriptCleanerDev() {
  const [rawTranscript, setRawTranscript] = useState('')
  const [parsedTurns, setParsedTurns] = useState<ParsedTurn[]>([])
  const [cleanedTurns, setCleanedTurns] = useState<CleanedTurn[]>([])
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null)
  const [apiCalls, setApiCalls] = useState<APICall[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  
  // Settings
  const [settings, setSettings] = useState({
    autoStart: false,
    showTimings: true,
    showDiffs: true,
    showMetadata: true,
    cleaningLevel: 'full' as 'none' | 'light' | 'full',
    modelName: 'gemini-2.5-flash-lite-preview-06-17'
  })

  const logAPICall = (call: APICall) => {
    setApiCalls(prev => [call, ...prev])
  }

  const apiCallWithLogging = async (method: string, endpoint: string, data?: any) => {
    const startTime = Date.now()
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      let response
      if (method === 'GET') {
        response = await apiClient.get(endpoint)
      } else if (method === 'POST') {
        response = await apiClient.post(endpoint, data)
      }
      
      const latency = Date.now() - startTime
      
      logAPICall({
        id: callId,
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        request_data: data,
        response_data: response,
        status: 200,
        latency_ms: latency
      })
      
      return response
    } catch (error: any) {
      const latency = Date.now() - startTime
      
      logAPICall({
        id: callId,
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        request_data: data,
        response_data: null,
        status: error.status || 500,
        latency_ms: latency,
        error: error.message
      })
      
      throw error
    }
  }

  const parseTranscript = async () => {
    if (!rawTranscript.trim()) return

    try {
      setIsProcessing(true)
      const response = await apiCallWithLogging('POST', '/api/v1/conversations/parse-transcript', {
        raw_transcript: rawTranscript
      })

      setParsedTurns(response.parsed_turns)
      setProcessingStats(response.stats)
      
      if (settings.autoStart) {
        setTimeout(() => startCleaning(), 500)
      }
    } catch (error) {
      console.error('Parse error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const startCleaning = async () => {
    if (parsedTurns.length === 0) return

    setIsProcessing(true)
    setCleanedTurns([])
    setCurrentTurnIndex(0)
    
    try {
      // Create new conversation
      const convResponse = await apiCallWithLogging('POST', '/api/v1/conversations', {
        name: `Dev Tool Session ${new Date().toLocaleString()}`,
        description: `Auto-generated dev session - ${parsedTurns.length} turns`
      })
      
      const newConversationId = convResponse.conversation.id
      setConversationId(newConversationId)
      
      // Process turns sequentially
      const cleaned: CleanedTurn[] = []
      
      for (let i = 0; i < parsedTurns.length; i++) {
        const turn = parsedTurns[i]
        setCurrentTurnIndex(i)
        
        try {
          const cleanResponse = await apiCallWithLogging('POST', `/api/v1/conversations/${newConversationId}/turns`, {
            speaker: turn.speaker,
            raw_text: turn.raw_text
          })
          
          cleaned.push(cleanResponse.turn)
          setCleanedTurns([...cleaned])
        } catch (turnError) {
          console.error(`Turn ${i + 1} failed:`, turnError)
        }
      }
    } catch (error) {
      console.error('Cleaning error:', error)
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
    }
  }

  const loadExampleScript = async () => {
    try {
      const response = await fetch('/examplescripts/examplescript2')
      const content = await response.text()
      setRawTranscript(content)
      
      if (settings.autoStart) {
        setTimeout(() => parseTranscript(), 100)
      }
    } catch (error) {
      console.error('Failed to load example script:', error)
    }
  }

  const calculateDiff = (original: string, cleaned: string) => {
    if (original === cleaned) return null
    
    // Simple word-level diff
    const origWords = original.split(' ')
    const cleanWords = cleaned.split(' ')
    
    const changes = []
    let i = 0, j = 0
    
    while (i < origWords.length || j < cleanWords.length) {
      if (i >= origWords.length) {
        changes.push({ type: 'added', text: cleanWords[j] })
        j++
      } else if (j >= cleanWords.length) {
        changes.push({ type: 'removed', text: origWords[i] })
        i++
      } else if (origWords[i] === cleanWords[j]) {
        changes.push({ type: 'unchanged', text: origWords[i] })
        i++
        j++
      } else {
        changes.push({ type: 'removed', text: origWords[i] })
        changes.push({ type: 'added', text: cleanWords[j] })
        i++
        j++
      }
    }
    
    return changes
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-green-400">Lumen Transcript Cleaner - Developer Tool</h1>
            <p className="text-gray-400 text-xs mt-1">
              Professional debugging interface • Gemini 2.5 Flash-Lite • Full API transparency
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-green-400">● LIVE</div>
            <div>API Calls: {apiCalls.length}</div>
            <div>Avg Latency: {apiCalls.length > 0 ? Math.round(apiCalls.reduce((a, b) => a + b.latency_ms, 0) / apiCalls.length) : 0}ms</div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center gap-6 text-xs">
          <label className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={settings.autoStart}
              onChange={(e) => setSettings({...settings, autoStart: e.target.checked})}
              className="rounded"
            />
            Auto-process
          </label>
          <label className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={settings.showTimings}
              onChange={(e) => setSettings({...settings, showTimings: e.target.checked})}
              className="rounded"
            />
            Show timings
          </label>
          <label className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={settings.showDiffs}
              onChange={(e) => setSettings({...settings, showDiffs: e.target.checked})}
              className="rounded"
            />
            Show diffs
          </label>
          <select 
            value={settings.cleaningLevel}
            onChange={(e) => setSettings({...settings, cleaningLevel: e.target.value as any})}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
          >
            <option value="none">No cleaning</option>
            <option value="light">Light cleaning</option>
            <option value="full">Full cleaning</option>
          </select>
          <button 
            onClick={loadExampleScript}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
          >
            Load Example
          </button>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Left Panel - Input */}
        <div className="w-1/3 bg-gray-900 border-r border-gray-700 flex flex-col">
          <div className="bg-gray-800 p-3 border-b border-gray-700">
            <h3 className="font-semibold text-green-400">Raw Transcript Input</h3>
            <p className="text-xs text-gray-400 mt-1">Paste your messy transcript here</p>
          </div>
          
          <div className="flex-1 p-3">
            <textarea
              value={rawTranscript}
              onChange={(e) => setRawTranscript(e.target.value)}
              placeholder="Paste your raw transcript here... (AI/User format supported)"
              className="w-full h-full bg-gray-800 border border-gray-600 rounded p-3 text-sm font-mono resize-none"
            />
          </div>
          
          <div className="p-3 border-t border-gray-700">
            <div className="flex gap-2 mb-3">
              <button 
                onClick={parseTranscript}
                disabled={!rawTranscript.trim() || isProcessing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 px-3 py-2 rounded font-medium"
              >
                {isProcessing ? 'Parsing...' : 'Parse Transcript'}
              </button>
              <button 
                onClick={startCleaning}
                disabled={parsedTurns.length === 0 || isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-3 py-2 rounded font-medium"
              >
                {isProcessing ? `Processing ${currentTurnIndex + 1}/${parsedTurns.length}` : 'Start Cleaning'}
              </button>
            </div>
            
            <div className="text-xs text-gray-400">
              {rawTranscript.length.toLocaleString()} chars
              {processingStats && (
                <span className="ml-4">
                  {processingStats.total_turns} turns • {processingStats.user_turns} user • {processingStats.lumen_turns} AI
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle Panel - Processing Results */}
        <div className="w-1/3 bg-gray-900 border-r border-gray-700 flex flex-col">
          <div className="bg-gray-800 p-3 border-b border-gray-700">
            <h3 className="font-semibold text-green-400">Processing Results</h3>
            <p className="text-xs text-gray-400 mt-1">Real-time cleaning results with diffs</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {cleanedTurns.map((turn, index) => {
              const diff = settings.showDiffs ? calculateDiff(turn.raw_text, turn.cleaned_text) : null
              
              return (
                <div key={turn.turn_id} className="bg-gray-800 border border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        turn.speaker === 'User' ? 'bg-blue-600' : 'bg-purple-600'
                      }`}>
                        {turn.speaker}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        turn.metadata.confidence_score === 'HIGH' ? 'bg-green-600' : 
                        turn.metadata.confidence_score === 'MEDIUM' ? 'bg-yellow-600' : 'bg-red-600'
                      }`}>
                        {turn.metadata.confidence_score}
                      </span>
                      {turn.metadata.cleaning_applied && (
                        <span className="px-2 py-1 bg-orange-600 rounded text-xs">CLEANED</span>
                      )}
                    </div>
                    {settings.showTimings && (
                      <span className="text-xs text-gray-400">{turn.metadata.processing_time_ms.toFixed(1)}ms</span>
                    )}
                  </div>
                  
                  {settings.showDiffs && diff && (
                    <div className="mb-2 p-2 bg-gray-900 rounded text-xs">
                      <div className="text-gray-400 mb-1">Diff:</div>
                      <div className="flex flex-wrap gap-1">
                        {diff.map((change, i) => (
                          <span key={i} className={`
                            ${change.type === 'added' ? 'bg-green-600 text-white' :
                              change.type === 'removed' ? 'bg-red-600 text-white line-through' :
                              'text-gray-300'}
                            px-1 rounded
                          `}>
                            {change.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm mb-2">{turn.cleaned_text}</div>
                  
                  {turn.metadata.corrections.length > 0 && (
                    <div className="text-xs text-gray-400 border-t border-gray-600 pt-2">
                      <div className="font-medium mb-1">Corrections ({turn.metadata.corrections.length}):</div>
                      {turn.metadata.corrections.map((correction, i) => (
                        <div key={i} className="mb-1">
                          <span className="text-red-400">"{correction.original}"</span> → 
                          <span className="text-green-400"> "{correction.corrected}"</span>
                          <span className="text-gray-500 ml-2">({correction.reason})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {settings.showMetadata && (
                    <div className="text-xs text-gray-500 border-t border-gray-600 pt-2 mt-2">
                      <div>Model: {turn.metadata.ai_model_used || 'bypass'}</div>
                      <div>Context: {turn.metadata.context_detected}</div>
                      <div>Level: {turn.metadata.cleaning_level}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel - API Calls & Debug */}
        <div className="w-1/3 bg-gray-900 flex flex-col">
          <div className="bg-gray-800 p-3 border-b border-gray-700">
            <h3 className="font-semibold text-green-400">API Calls & Debug</h3>
            <p className="text-xs text-gray-400 mt-1">Real-time API monitoring</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {apiCalls.map((call) => (
              <div key={call.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      call.status === 200 ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {call.method}
                    </span>
                    <span className="text-xs text-gray-400">{call.latency_ms}ms</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(call.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="text-xs font-medium mb-1">{call.endpoint}</div>
                
                {call.request_data && (
                  <details className="mb-2">
                    <summary className="text-xs text-gray-400 cursor-pointer">Request</summary>
                    <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(call.request_data, null, 2)}
                    </pre>
                  </details>
                )}
                
                {call.response_data && (
                  <details>
                    <summary className="text-xs text-gray-400 cursor-pointer">Response</summary>
                    <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(call.response_data, null, 2)}
                    </pre>
                  </details>
                )}
                
                {call.error && (
                  <div className="text-xs text-red-400 bg-red-900 p-2 rounded mt-1">
                    Error: {call.error}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t border-gray-700">
            <button 
              onClick={() => setApiCalls([])}
              className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-xs"
            >
              Clear API Log
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}