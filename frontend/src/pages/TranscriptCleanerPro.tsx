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

export function TranscriptCleanerPro() {
  // Theme helper functions
  const getFontSize = () => {
    switch (fontSize) {
      case 'small': return '12px'
      case 'large': return '16px'
      default: return '14px' // medium
    }
  }
  
  const getSpacing = (base: number) => {
    return uiMode === 'compact' ? Math.round(base * 0.6) : base
  }
  
  const getThemeColors = () => {
    if (darkMode) {
      return {
        bg: '#1f2937',
        bgSecondary: '#374151',
        bgTertiary: '#4b5563',
        text: '#f9fafb',
        textSecondary: '#d1d5db',
        textMuted: '#9ca3af',
        border: '#4b5563',
        accent: '#3b82f6'
      }
    } else {
      return {
        bg: '#ffffff',
        bgSecondary: '#f9fafb',
        bgTertiary: '#f3f4f6',
        text: '#111827',
        textSecondary: '#374151',
        textMuted: '#6b7280',
        border: '#e5e7eb',
        accent: '#3b82f6'
      }
    }
  }
  
  // State declarations
  const [rawTranscript, setRawTranscript] = useState('')
  const [parsedTurns, setParsedTurns] = useState<ParsedTurn[]>([])
  const [cleanedTurns, setCleanedTurns] = useState<CleanedTurn[]>([])
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null)
  const [apiCalls, setApiCalls] = useState<APICall[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'results' | 'api' | 'logs' | 'settings'>('results')
  const [darkMode, setDarkMode] = useState(false)
  const [detailedLogs, setDetailedLogs] = useState<string[]>([])
  const [hideLumenTurns, setHideLumenTurns] = useState(false)
  const [showOnlyCleaned, setShowOnlyCleaned] = useState(false)
  const [uiMode, setUIMode] = useState<'normal' | 'compact'>('normal')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem('transcript-cleaner-panel-width')
    return saved ? parseInt(saved) : 20
  })
  
  // Save panel width to localStorage
  React.useEffect(() => {
    localStorage.setItem('transcript-cleaner-panel-width', leftPanelWidth.toString())
  }, [leftPanelWidth])

  const theme = getThemeColors()
  
  // Initialize logging
  React.useEffect(() => {
    addDetailedLog('Lumen Transcript Cleaner initialized')
    addDetailedLog(`Theme mode: ${darkMode ? 'dark' : 'light'}`)
  }, [])
  
  React.useEffect(() => {
    addDetailedLog(`Theme switched to ${darkMode ? 'dark' : 'light'} mode`)
  }, [darkMode])
  
  // Settings with local storage persistence
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('transcript-cleaner-settings')
    return saved ? JSON.parse(saved) : {
      autoStart: false,
      autoProcessOnPaste: false,
      showTimings: true,
      showDiffs: true,
      showMetadata: true,
      cleaningLevel: 'full' as 'none' | 'light' | 'full',
      modelName: 'gemini-2.5-flash-lite-preview-06-17',
      // Error Handling
      skipTranscriptionErrors: true,
      // Gemini Model Parameters
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxTokens: 65535,
      // Sliding Window Configuration
      slidingWindow: 5
    }
  })
  
  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('transcript-cleaner-settings', JSON.stringify(settings))
  }, [settings])

  const logAPICall = (call: APICall) => {
    setApiCalls(prev => [call, ...prev])
    addDetailedLog(`API Call: ${call.method} ${call.endpoint} - ${call.status} (${call.latency_ms}ms)`)
  }

  const addDetailedLog = (message: string) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}`
    setDetailedLogs(prev => [logEntry, ...prev].slice(0, 1000)) // Keep last 1000 logs
    console.log(logEntry)
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

    addDetailedLog(`Starting transcript parsing - ${rawTranscript.length} characters`)
    try {
      setIsProcessing(true)
      const response = await apiCallWithLogging('POST', '/api/v1/conversations/parse-transcript', {
        raw_transcript: rawTranscript
      })

      setParsedTurns(response.parsed_turns)
      setProcessingStats(response.stats)
      addDetailedLog(`✅ Transcript parsed successfully: ${response.parsed_turns.length} turns`)
      
      if (settings.autoStart) {
        addDetailedLog('Auto-start enabled, beginning cleaning in 500ms')
        setTimeout(() => startCleaning(), 500)
      }
    } catch (error) {
      addDetailedLog(`❌ Parse error: ${error}`)
      console.error('Parse error:', error)
    } finally {
      setIsProcessing(false)
      addDetailedLog('Parse transcript process completed')
    }
  }

  const startCleaning = async () => {
    if (parsedTurns.length === 0) return

    addDetailedLog(`Starting cleaning process for ${parsedTurns.length} turns`)

    setIsProcessing(true)
    setCleanedTurns([])
    setCurrentTurnIndex(0)
    setSelectedTab('results')
    
    try {
      // Create new conversation
      const convResponse = await apiCallWithLogging('POST', '/api/v1/conversations', {
        name: `Professional Session ${new Date().toLocaleString()}`,
        description: `Professional dev tool session - ${parsedTurns.length} turns`,
        metadata: {
          sliding_window: settings.slidingWindow,
          model_params: {
            temperature: settings.temperature,
            top_p: settings.topP,
            top_k: settings.topK,
            max_tokens: settings.maxTokens,
            model_name: settings.modelName
          }
        }
      })
      
      const newConversationId = convResponse.id || convResponse.conversation?.id
      if (!newConversationId) {
        throw new Error('Failed to get conversation ID from response')
      }
      addDetailedLog(`📝 Conversation created with ID: ${newConversationId}`)
      setConversationId(newConversationId)
      
      // Process turns sequentially with real-time display
      const cleaned: CleanedTurn[] = []
      addDetailedLog(`🚀 Starting sequential cleaning of ${parsedTurns.length} turns`)
      addDetailedLog(`Sliding window: ${settings.slidingWindow} turns | Cleaning level: ${settings.cleaningLevel}`)
      
      for (let i = 0; i < parsedTurns.length; i++) {
        const turn = parsedTurns[i]
        setCurrentTurnIndex(i)
        
        addDetailedLog(`\n📍 Processing turn ${i + 1}/${parsedTurns.length}: ${turn.speaker}`)
        addDetailedLog(`Raw text (${turn.raw_text.length} chars): "${turn.raw_text.substring(0, 100)}${turn.raw_text.length > 100 ? '...' : ''}"")`)
        
        // Log context being sent
        if (cleaned.length > 0) {
          const contextTurns = cleaned.slice(-settings.slidingWindow)
          addDetailedLog(`📚 Context: Sending ${contextTurns.length} previous cleaned turns as context`)
          contextTurns.forEach((ctx, idx) => {
            addDetailedLog(`  Context[${idx + 1}]: ${ctx.speaker} - "${ctx.cleaned_text.substring(0, 50)}...""`)
          })
        } else {
          addDetailedLog(`📚 Context: No previous turns (first turn)`)
        }
        
        try {
          addDetailedLog(`🤖 Sending to Gemini 2.5 Flash-Lite...`)
          const turnStartTime = Date.now()
          
          // Call the turn processing endpoint - THIS WAS MISSING
          const cleanResponse = await apiCallWithLogging('POST', `/api/v1/conversations/${newConversationId}/turns`, {
            speaker: turn.speaker,
            raw_text: turn.raw_text,
            metadata: {
              sliding_window: settings.slidingWindow,
              cleaning_level: settings.cleaningLevel,
              skip_transcription_errors: settings.skipTranscriptionErrors,
              model_params: {
                temperature: settings.temperature,
                top_p: settings.topP,
                top_k: settings.topK,
                max_tokens: settings.maxTokens,
                model_name: settings.modelName
              }
            }
          })
          
          const turnEndTime = Date.now()
          const turnProcessingTime = turnEndTime - turnStartTime
          
          addDetailedLog(`✅ Turn ${i + 1} processed in ${turnProcessingTime}ms`)
          addDetailedLog(`Cleaned text (${cleanResponse.cleaned_text.length} chars): "${cleanResponse.cleaned_text.substring(0, 100)}${cleanResponse.cleaned_text.length > 100 ? '...' : ''}"")`)
          addDetailedLog(`Confidence: ${cleanResponse.metadata.confidence_score} | Cleaning applied: ${cleanResponse.metadata.cleaning_applied}`)
          
          if (cleanResponse.metadata.corrections && cleanResponse.metadata.corrections.length > 0) {
            addDetailedLog(`🔧 Applied ${cleanResponse.metadata.corrections.length} corrections:`)
            cleanResponse.metadata.corrections.forEach((correction, idx) => {
              addDetailedLog(`  ${idx + 1}. "${correction.original}" → "${correction.corrected}" (${correction.reason})`)
            })
          }
          
          cleaned.push(cleanResponse)
          setCleanedTurns([...cleaned])
          
          // Real-time update with progress indicator
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (turnError) {
          addDetailedLog(`❌ Turn ${i + 1} failed: ${turnError}`)
          console.error(`Turn ${i + 1} failed:`, turnError)
          // Create error turn to show in UI
          const errorTurn: CleanedTurn = {
            turn_id: `error-${i}`,
            conversation_id: newConversationId,
            speaker: turn.speaker,
            raw_text: turn.raw_text,
            cleaned_text: turn.raw_text,
            metadata: {
              confidence_score: 'LOW',
              cleaning_applied: false,
              cleaning_level: 'none',
              corrections: [],
              context_detected: 'error',
              processing_time_ms: 0,
              ai_model_used: 'error'
            },
            created_at: new Date().toISOString()
          }
          cleaned.push(errorTurn)
          setCleanedTurns([...cleaned])
        }
      }
    } catch (error) {
      addDetailedLog(`❌ Cleaning process failed: ${error}`)
      console.error('Cleaning error:', error)
      alert(`Cleaning failed: ${error.message || error}`)
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
      addDetailedLog('🏁 Cleaning process completed')
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

  // Calculate average latency excluding Lumen bypass calls (real API calls only)
  const realApiCalls = apiCalls.filter(call => 
    !call.endpoint.includes('/turns') || 
    !call.response_data?.metadata?.ai_model_used?.includes('bypass')
  )
  const averageLatency = realApiCalls.length > 0 ? Math.round(realApiCalls.reduce((a, b) => a + b.latency_ms, 0) / realApiCalls.length) : 0

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bgSecondary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: theme.bg,
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0
      }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '600', color: theme.text, margin: 0 }}>
                Lumen Transcript Cleaner
              </h1>
              <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '4px', margin: 0 }}>
                Professional debugging interface • Gemini 2.5 Flash-Lite • Full API transparency
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px' }}>
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  backgroundColor: theme.bgSecondary,
                  color: theme.text,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                <span style={{ color: theme.textMuted }}>Live</span>
              </div>
              <div style={{ color: theme.textMuted }}>
                <span style={{ fontWeight: '500' }}>{apiCalls.length}</span> API calls
              </div>
              <div style={{ color: theme.textMuted }}>
                <span style={{ fontWeight: '500' }}>{averageLatency}ms</span> avg latency
              </div>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div style={{ padding: '12px 24px', backgroundColor: theme.bgSecondary, borderTop: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={settings.autoStart}
                  onChange={(e) => setSettings({...settings, autoStart: e.target.checked})}
                  style={{ borderRadius: '4px' }}
                />
                <span style={{ color: theme.textSecondary }}>Auto-process</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={settings.showTimings}
                  onChange={(e) => setSettings({...settings, showTimings: e.target.checked})}
                  style={{ borderRadius: '4px' }}
                />
                <span style={{ color: theme.textSecondary }}>Show timings</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={settings.showDiffs}
                  onChange={(e) => setSettings({...settings, showDiffs: e.target.checked})}
                  style={{ borderRadius: '4px' }}
                />
                <span style={{ color: theme.textSecondary }}>Show diffs</span>
              </label>
              <select 
                value={settings.cleaningLevel}
                onChange={(e) => setSettings({...settings, cleaningLevel: e.target.value as any})}
                style={{ 
                  borderRadius: '6px', 
                  border: `1px solid ${theme.border}`, 
                  fontSize: '14px', 
                  padding: '4px 12px', 
                  backgroundColor: theme.bgSecondary,
                  color: theme.text 
                }}
              >
                <option value="none">No cleaning</option>
                <option value="light">Light cleaning</option>
                <option value="full">Full cleaning</option>
              </select>
            </div>
            <button 
              onClick={loadExampleScript}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: theme.textSecondary,
                backgroundColor: theme.bgSecondary,
                cursor: 'pointer'
              }}
            >
              Load Example
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Input */}
        <div style={{ 
          width: `${leftPanelWidth}%`, 
          backgroundColor: theme.bg, 
          borderRight: `1px solid ${theme.border}`, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: '15%',
          maxWidth: '50%'
        }}>
          <div style={{ padding: '24px', borderBottom: `1px solid ${theme.border}` }}>
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, margin: 0 }}>Raw Transcript</h2>
            <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '4px', margin: 0 }}>Paste your conversation transcript here</p>
          </div>
          
          <div style={{ flex: 1, padding: '24px' }}>
            <textarea
              value={rawTranscript}
              onChange={(e) => setRawTranscript(e.target.value)}
              onPaste={(e) => {
                if (settings.autoProcessOnPaste) {
                  // Wait for paste content to be applied, then auto-process
                  setTimeout(() => {
                    parseTranscript()
                  }, 100)
                }
              }}
              placeholder="Paste your raw transcript here... (AI/User format supported)"
              style={{
                width: '100%',
                height: '100%',
                resize: 'none',
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                padding: '12px',
                fontSize: '14px',
                fontFamily: 'monospace',
                outline: 'none',
                backgroundColor: theme.bgSecondary,
                color: theme.text
              }}
            />
          </div>
          
          <div style={{ padding: '24px', borderTop: `1px solid ${theme.border}`, backgroundColor: theme.bgTertiary }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button 
                onClick={parseTranscript}
                disabled={!rawTranscript.trim() || isProcessing}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: isProcessing || !rawTranscript.trim() ? theme.textMuted : theme.accent,
                  cursor: isProcessing || !rawTranscript.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Parsing...' : 'Parse Transcript'}
              </button>
              <button 
                onClick={startCleaning}
                disabled={parsedTurns.length === 0 || isProcessing}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: isProcessing || parsedTurns.length === 0 ? '#9ca3af' : '#10b981',
                  cursor: isProcessing || parsedTurns.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? `Processing ${currentTurnIndex + 1}/${parsedTurns.length}` : 'Start Cleaning'}
              </button>
            </div>
            
            <div style={{ fontSize: '14px', color: theme.textMuted }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{rawTranscript.length.toLocaleString()} characters</span>
                {processingStats && (
                  <span>{processingStats.total_turns} turns ({processingStats.user_turns} user, {processingStats.lumen_turns} AI)</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Drag Handle */}
        <div 
          style={{ 
            width: '4px', 
            backgroundColor: theme.border, 
            cursor: 'col-resize',
            position: 'relative',
            zIndex: 10
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = leftPanelWidth
            const containerWidth = e.currentTarget.parentElement!.getBoundingClientRect().width
            
            const handleMouseMove = (e: MouseEvent) => {
              const deltaX = e.clientX - startX
              const deltaPercent = (deltaX / containerWidth) * 100
              const newWidth = Math.min(50, Math.max(15, startWidth + deltaPercent))
              setLeftPanelWidth(newWidth)
            }
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
            }
            
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px',
            height: '40px',
            backgroundColor: theme.textMuted,
            borderRadius: '1px'
          }} />
        </div>

        {/* Right Panel - Tabbed Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg }}>
          {/* Tabs */}
          <div style={{ borderBottom: `1px solid ${theme.border}` }}>
            <nav style={{ display: 'flex', gap: '32px', padding: '0 24px' }}>
              {[
                { key: 'results', label: 'Results', count: cleanedTurns.length },
                { key: 'api', label: 'API Calls', count: apiCalls.length },
                { key: 'logs', label: 'Detailed Logs', count: detailedLogs.length },
                { key: 'settings', label: 'Configuration', count: null }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as any)}
                  style={{
                    padding: '16px 4px',
                    borderBottom: selectedTab === tab.key ? `2px solid ${theme.accent}` : '2px solid transparent',
                    fontWeight: '500',
                    fontSize: '14px',
                    color: selectedTab === tab.key ? theme.accent : theme.textMuted,
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      backgroundColor: selectedTab === tab.key ? (darkMode ? '#1e3a8a' : '#dbeafe') : theme.bgTertiary,
                      color: selectedTab === tab.key ? (darkMode ? '#93c5fd' : '#3b82f6') : theme.textMuted
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {selectedTab === 'results' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: `${getSpacing(24)}px`, display: 'flex', flexDirection: 'column', gap: `${getSpacing(24)}px`, fontSize: getFontSize() }}>
                  {/* Filter Controls */}
                  {cleanedTurns.length > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      padding: '12px', 
                      backgroundColor: theme.bgSecondary, 
                      borderRadius: '8px', 
                      border: `1px solid ${theme.border}` 
                    }}>
                      <button
                        onClick={() => setHideLumenTurns(!hideLumenTurns)}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: hideLumenTurns ? theme.accent : theme.bgSecondary,
                          color: hideLumenTurns ? 'white' : theme.textSecondary,
                          cursor: 'pointer'
                        }}
                      >
                        {hideLumenTurns ? '✓ ' : ''}Hide Lumen
                      </button>
                      <button
                        onClick={() => setShowOnlyCleaned(!showOnlyCleaned)}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: showOnlyCleaned ? theme.accent : theme.bgSecondary,
                          color: showOnlyCleaned ? 'white' : theme.textSecondary,
                          cursor: 'pointer'
                        }}
                      >
                        {showOnlyCleaned ? '✓ ' : ''}Only Cleaned
                      </button>
                      <div style={{ 
                        fontSize: '12px', 
                        color: theme.textMuted, 
                        display: 'flex', 
                        alignItems: 'center',
                        marginLeft: 'auto'
                      }}>
                        Showing {cleanedTurns.filter(turn => {
                          if (hideLumenTurns && turn.speaker === 'Lumen') return false
                          if (showOnlyCleaned && !turn.metadata.cleaning_applied) return false
                          return true
                        }).length} of {cleanedTurns.length} turns
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                        <button
                          onClick={() => setUIMode(uiMode === 'normal' ? 'compact' : 'normal')}
                          style={{
                            padding: '6px 12px',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: uiMode === 'compact' ? theme.accent : theme.bgSecondary,
                            color: uiMode === 'compact' ? 'white' : theme.textSecondary,
                            cursor: 'pointer'
                          }}
                        >
                          {uiMode === 'compact' ? '✓ ' : ''}Compact
                        </button>
                        <select
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value as any)}
                          style={{
                            padding: '6px 8px',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            backgroundColor: theme.bgSecondary,
                            color: theme.textSecondary,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {/* Explanation Panel */}
                  <div style={{ 
                    backgroundColor: theme.bgTertiary, 
                    borderRadius: '8px', 
                    padding: '16px', 
                    border: `1px solid ${theme.border}`,
                    fontSize: '14px'
                  }}>
                    <div style={{ fontWeight: '600', color: theme.text, marginBottom: '8px' }}>Understanding the Results:</div>
                    <div style={{ color: theme.textSecondary, lineHeight: '1.5' }}>
                      • <strong>User turns</strong> (light blue background) are processed by AI for cleaning<br/>
                      • <strong>Lumen turns</strong> (cyan background) pass through without processing<br/>
                      • <strong>HIGH confidence</strong> (green) = AI is very confident in cleaning quality<br/>
                      • <strong>MEDIUM confidence</strong> (yellow) = Moderately confident<br/>
                      • <strong>LOW confidence</strong> (red) = Review recommended, possible transcription errors
                    </div>
                  </div>
                  {/* Live Processing Indicator */}
                  {isProcessing && (
                    <div style={{ 
                      backgroundColor: theme.bgSecondary, 
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px', 
                      padding: '20px', 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        border: `3px solid ${theme.accent}`,
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: theme.text, fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                          Processing Turn {currentTurnIndex + 1} of {parsedTurns.length}
                        </div>
                        <div style={{ color: theme.textMuted, fontSize: '14px' }}>
                          {parsedTurns[currentTurnIndex]?.speaker}: {parsedTurns[currentTurnIndex]?.raw_text.substring(0, 60)}...
                        </div>
                      </div>
                      <div style={{ 
                        backgroundColor: theme.bgTertiary,
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: theme.textSecondary
                      }}>
                        {Math.round((currentTurnIndex / parsedTurns.length) * 100)}%
                      </div>
                    </div>
                  )}
                  
                  {cleanedTurns.length === 0 && !isProcessing ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: theme.textMuted }}>
                      <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No results yet</div>
                      <div style={{ fontSize: '14px' }}>Process a transcript to see cleaning results here</div>
                    </div>
                  ) : (
                    cleanedTurns
                      .filter(turn => {
                        if (hideLumenTurns && turn.speaker === 'Lumen') return false
                        if (showOnlyCleaned && !turn.metadata.cleaning_applied) return false
                        return true
                      })
                      .map((turn, index) => {
                      const diff = settings.showDiffs ? calculateDiff(turn.raw_text, turn.cleaned_text) : null
                      
                      return (
                        <div key={turn.turn_id} style={{ 
                          backgroundColor: turn.speaker === 'User' ? 
                            (darkMode ? '#1e293b' : '#f8fafc') : 
                            (darkMode ? '#164e63' : '#e0f2fe'), 
                          borderRadius: '8px', 
                          padding: `${getSpacing(24)}px`, 
                          border: `1px solid ${theme.border}`,
                          marginBottom: `${getSpacing(16)}px`
                        }}>
                          {/* Turn Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${getSpacing(20)}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '16px', fontWeight: '600', color: theme.text }}>
                                Turn {index + 1}
                              </span>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: turn.speaker === 'User' ? '#dbeafe' : '#a7f3d0',
                                color: turn.speaker === 'User' ? '#1d4ed8' : '#065f46'
                              }}>
                                {turn.speaker}
                              </span>
                              <span 
                                title={`AI Confidence: ${turn.metadata.confidence_score === 'HIGH' ? 'Very confident in cleaning quality' : turn.metadata.confidence_score === 'MEDIUM' ? 'Moderately confident' : 'Low confidence - review recommended'}`}
                                style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: turn.metadata.confidence_score === 'HIGH' ? '#dcfce7' : 
                                  turn.metadata.confidence_score === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
                                color: turn.metadata.confidence_score === 'HIGH' ? '#166534' : 
                                  turn.metadata.confidence_score === 'MEDIUM' ? '#92400e' : '#991b1b',
                                cursor: 'help'
                              }}>
                                {turn.metadata.confidence_score}
                              </span>
                              {turn.metadata.cleaning_applied && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: '#fed7aa',
                                  color: '#c2410c'
                                }}>
                                  Cleaned
                                </span>
                              )}
                            </div>
                            {settings.showTimings && (
                              <span style={{ fontSize: '14px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                {turn.metadata.processing_time_ms.toFixed(1)}ms
                              </span>
                            )}
                          </div>
                          
                          {settings.showDiffs && diff && (
                            <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: theme.bg, borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '8px' }}>Changes:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '14px' }}>
                                {diff.map((change, i) => (
                                  <span key={i} style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: change.type === 'added' ? '#dcfce7' : 
                                      change.type === 'removed' ? '#fee2e2' : 'transparent',
                                    color: change.type === 'added' ? '#166534' : 
                                      change.type === 'removed' ? '#991b1b' : theme.text,
                                    textDecoration: change.type === 'removed' ? 'line-through' : 'none'
                                  }}>
                                    {change.text}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Side-by-Side Original vs Cleaned */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Original Text */}
                            <div style={{ 
                              backgroundColor: theme.bgTertiary, 
                              borderRadius: '6px', 
                              padding: '16px',
                              border: `1px solid ${theme.border}`
                            }}>
                              <div style={{ 
                                fontSize: '12px', 
                                fontWeight: '600', 
                                color: theme.textMuted, 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '8px' 
                              }}>
                                ORIGINAL → GEMINI
                              </div>
                              <div style={{ 
                                color: theme.textSecondary, 
                                lineHeight: '1.6', 
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word'
                              }}>
                                {turn.raw_text}
                              </div>
                              <div style={{ 
                                fontSize: '11px', 
                                color: theme.textMuted, 
                                marginTop: '8px',
                                fontFamily: 'monospace'
                              }}>
                                {turn.raw_text.length} chars
                              </div>
                            </div>
                            
                            {/* Cleaned Text */}
                            <div style={{ 
                              backgroundColor: theme.bg, 
                              borderRadius: '6px', 
                              padding: '16px',
                              border: `2px solid ${turn.metadata.cleaning_applied ? '#10b981' : theme.border}`
                            }}>
                              <div style={{ 
                                fontSize: '12px', 
                                fontWeight: '600', 
                                color: turn.metadata.cleaning_applied ? '#10b981' : theme.textMuted, 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '8px' 
                              }}>
                                GEMINI → CLEANED
                              </div>
                              <div style={{ 
                                color: theme.text, 
                                lineHeight: '1.6', 
                                fontSize: '14px',
                                wordBreak: 'break-word'
                              }}>
                                {turn.cleaned_text}
                              </div>
                              <div style={{ 
                                fontSize: '11px', 
                                color: theme.textMuted, 
                                marginTop: '8px',
                                fontFamily: 'monospace',
                                display: 'flex',
                                justifyContent: 'space-between'
                              }}>
                                <span>{turn.cleaned_text.length} chars</span>
                                <span style={{ color: turn.metadata.cleaning_applied ? '#10b981' : theme.textMuted }}>
                                  {turn.metadata.processing_time_ms.toFixed(1)}ms
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {turn.metadata.corrections.length > 0 && (
                            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '16px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>
                                Corrections ({turn.metadata.corrections.length}):
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {turn.metadata.corrections.map((correction, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                                    <div style={{ flex: 1 }}>
                                      <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>"{correction.original}"</span>
                                      <span style={{ color: theme.textMuted, margin: '0 8px' }}>→</span>
                                      <span style={{ color: '#059669', fontFamily: 'monospace' }}>"{correction.corrected}"</span>
                                    </div>
                                    <div style={{ color: theme.textMuted, fontSize: '12px' }}>{correction.reason}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {settings.showMetadata && (
                            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: `${getSpacing(16)}px`, marginTop: `${getSpacing(16)}px` }}>
                              {/* Only show metadata for User turns, hide for Lumen */}
                              {turn.speaker !== 'Lumen' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: `${getSpacing(16)}px`, fontSize: getFontSize() }}>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Model:</div>
                                    <div style={{ color: theme.textMuted, fontFamily: 'monospace', fontSize: 'calc(' + getFontSize() + ' - 2px)' }}>{turn.metadata.ai_model_used || 'bypass'}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Context:</div>
                                    <div style={{ color: theme.textMuted }}>{turn.metadata.context_detected}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Level:</div>
                                    <div style={{ color: theme.textMuted }}>{turn.metadata.cleaning_level}</div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 'calc(' + getFontSize() + ' - 2px)', color: theme.textMuted, fontStyle: 'italic' }}>
                                  Lumen response - no processing metadata
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            
            {selectedTab === 'api' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: '24px' }}>
                  {apiCalls.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: theme.textMuted }}>
                      <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No API calls yet</div>
                      <div style={{ fontSize: '14px' }}>API requests will appear here as they happen</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {apiCalls.map((call) => (
                        <div key={call.id} style={{ backgroundColor: theme.bgSecondary, borderRadius: '8px', padding: '24px', border: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: call.status === 200 ? '#dcfce7' : '#fee2e2',
                                color: call.status === 200 ? '#166534' : '#991b1b'
                              }}>
                                {call.method}
                              </span>
                              <span style={{ fontSize: '14px', color: theme.textMuted, fontFamily: 'monospace' }}>{call.latency_ms}ms</span>
                            </div>
                            <span style={{ fontSize: '14px', color: theme.textMuted }}>
                              {new Date(call.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '14px', fontFamily: 'monospace', color: theme.text, marginBottom: '16px' }}>{call.endpoint}</div>
                          
                          {call.request_data && (
                            <details style={{ marginBottom: '16px' }}>
                              <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                Request Data
                              </summary>
                              <pre style={{ 
                                fontSize: '12px', 
                                backgroundColor: theme.bg, 
                                padding: '16px', 
                                borderRadius: '6px', 
                                border: `1px solid ${theme.border}`, 
                                overflowX: 'auto', 
                                fontFamily: 'monospace', 
                                color: theme.text,
                                margin: 0
                              }}>
                                {JSON.stringify(call.request_data, null, 2)}
                              </pre>
                            </details>
                          )}
                          
                          {call.response_data && (
                            <details>
                              <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                Response Data
                              </summary>
                              <pre style={{ 
                                fontSize: '12px', 
                                backgroundColor: theme.bg, 
                                padding: '16px', 
                                borderRadius: '6px', 
                                border: `1px solid ${theme.border}`, 
                                overflowX: 'auto', 
                                fontFamily: 'monospace', 
                                color: theme.text,
                                margin: 0
                              }}>
                                {JSON.stringify(call.response_data, null, 2)}
                              </pre>
                            </details>
                          )}
                          
                          {call.error && (
                            <div style={{ 
                              backgroundColor: '#fef2f2', 
                              border: '1px solid #fecaca', 
                              borderRadius: '6px', 
                              padding: '12px', 
                              marginTop: '16px' 
                            }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#b91c1c' }}>Error:</div>
                              <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '4px' }}>{call.error}</div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <div style={{ paddingTop: '16px' }}>
                        <button 
                          onClick={() => setApiCalls([])}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '8px 16px',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: theme.textSecondary,
                            backgroundColor: theme.bgSecondary,
                            cursor: 'pointer'
                          }}
                        >
                          Clear API Log
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedTab === 'logs' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, margin: 0 }}>Detailed Logs</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => {
                          const logsText = detailedLogs.join('\n')
                          navigator.clipboard.writeText(logsText)
                          alert('Logs copied to clipboard!')
                        }}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          backgroundColor: theme.accent,
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Copy Logs
                      </button>
                      <button
                        onClick={() => setDetailedLogs([])}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          backgroundColor: theme.bgSecondary,
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Clear Logs
                      </button>
                      <div style={{ 
                        padding: '6px 12px',
                        backgroundColor: theme.bgTertiary,
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.textMuted
                      }}>
                        {detailedLogs.length} entries
                      </div>
                    </div>
                  </div>
                  
                  {detailedLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: theme.textMuted }}>
                      <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No logs yet</div>
                      <div style={{ fontSize: '14px' }}>Application events will appear here</div>
                    </div>
                  ) : (
                    <div style={{ 
                      backgroundColor: theme.bgSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      maxHeight: '500px',
                      overflowY: 'auto'
                    }}>
                      {detailedLogs.map((log, index) => (
                        <div 
                          key={index}
                          style={{ 
                            padding: '8px 12px',
                            borderBottom: index < detailedLogs.length - 1 ? `1px solid ${theme.border}` : 'none',
                            color: theme.textSecondary,
                            wordBreak: 'break-all'
                          }}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedTab === 'settings' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ maxWidth: '512px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, marginBottom: '24px' }}>Configuration</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>Processing Options</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.autoStart}
                              onChange={(e) => setSettings({...settings, autoStart: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Auto-start cleaning after parsing</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.autoProcessOnPaste}
                              onChange={(e) => setSettings({...settings, autoProcessOnPaste: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Auto-process on paste (parse + clean immediately)</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.skipTranscriptionErrors}
                              onChange={(e) => setSettings({...settings, skipTranscriptionErrors: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Skip likely transcription errors (foreign chars, gibberish)</span>
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>Display Options</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.showTimings}
                              onChange={(e) => setSettings({...settings, showTimings: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Show processing timings</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.showDiffs}
                              onChange={(e) => setSettings({...settings, showDiffs: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Show text differences</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={settings.showMetadata}
                              onChange={(e) => setSettings({...settings, showMetadata: e.target.checked})}
                              style={{ borderRadius: '4px' }}
                            />
                            <span style={{ marginLeft: '12px', fontSize: '14px', color: theme.textSecondary }}>Show detailed metadata</span>
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>Context Window Settings</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Sliding Window: {settings.slidingWindow} turns
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type="range"
                                min="0"
                                max="20"
                                value={settings.slidingWindow}
                                onChange={(e) => setSettings({...settings, slidingWindow: parseInt(e.target.value)})}
                                style={{ 
                                  width: '100%',
                                  height: '6px',
                                  borderRadius: '3px',
                                  backgroundColor: theme.border,
                                  outline: 'none',
                                  appearance: 'none'
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                                <span>0</span>
                                <span>5</span>
                                <span>10</span>
                                <span>Max</span>
                              </div>
                            </div>
                            <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                              Include previous {settings.slidingWindow} turns when processing current turn
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>AI Model Settings</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Cleaning Level
                            </label>
                            <select 
                              value={settings.cleaningLevel}
                              onChange={(e) => setSettings({...settings, cleaningLevel: e.target.value as any})}
                              style={{ 
                                display: 'block', 
                                width: '100%', 
                                borderRadius: '6px', 
                                border: `1px solid ${theme.border}`, 
                                padding: '8px 12px',
                                backgroundColor: theme.bg
                              }}
                            >
                              <option value="none">No cleaning</option>
                              <option value="light">Light cleaning</option>
                              <option value="full">Full cleaning</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Model Name
                            </label>
                            <input 
                              type="text"
                              value={settings.modelName}
                              onChange={(e) => setSettings({...settings, modelName: e.target.value})}
                              style={{ 
                                display: 'block', 
                                width: '100%', 
                                borderRadius: '6px', 
                                border: `1px solid ${theme.border}`, 
                                padding: '8px 12px',
                                fontFamily: 'monospace', 
                                fontSize: '14px',
                                backgroundColor: theme.bg
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>Model Parameters</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Temperature: {settings.temperature}
                            </label>
                            <input 
                              type="range"
                              min="0"
                              max="2"
                              step="0.1"
                              value={settings.temperature}
                              onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                              style={{ 
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor: theme.border,
                                outline: 'none',
                                appearance: 'none'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Top-p: {settings.topP}
                            </label>
                            <input 
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={settings.topP}
                              onChange={(e) => setSettings({...settings, topP: parseFloat(e.target.value)})}
                              style={{ 
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor: theme.border,
                                outline: 'none',
                                appearance: 'none'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Top-k: {settings.topK}
                            </label>
                            <input 
                              type="range"
                              min="1"
                              max="100"
                              value={settings.topK}
                              onChange={(e) => setSettings({...settings, topK: parseInt(e.target.value)})}
                              style={{ 
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor: theme.border,
                                outline: 'none',
                                appearance: 'none'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Max Tokens: {settings.maxTokens}
                            </label>
                            <input 
                              type="range"
                              min="1000"
                              max="65535"
                              step="1000"
                              value={settings.maxTokens}
                              onChange={(e) => setSettings({...settings, maxTokens: parseInt(e.target.value)})}
                              style={{ 
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor: theme.border,
                                outline: 'none',
                                appearance: 'none'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}