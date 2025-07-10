import React, { useState } from 'react'
import { apiClient } from '../lib/api'
import { GeminiQueryInspector } from '../components/GeminiQueryInspector'

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
  processing_state?: 'pending' | 'processing' | 'completed' | 'skipped'
  metadata: {
    confidence_score: string
    cleaning_applied: boolean
    cleaning_level: string
    timing_breakdown?: {
      context_retrieval_ms: number
      prompt_preparation_ms: number
      gemini_api_ms: number
      database_save_ms: number
      prompt_logging_ms: number
      total_ms: number
    }
    corrections: Array<{
      original: string
      corrected: string
      confidence: string
      reason: string
    }>
    context_detected: string
    processing_time_ms: number
    ai_model_used: string
    gemini_prompt?: string
    gemini_response?: string
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

interface TranscriptCleanerProProps {
  user?: { id: string; email: string; created_at: string } | null
  logout?: () => Promise<void>
}

export function TranscriptCleanerPro({ user, logout }: TranscriptCleanerProProps = {}) {
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
  const [parsedTurns, setParsedTurns] = useState<ParsedTurn[]>([])
  const [cleanedTurns, setCleanedTurns] = useState<CleanedTurn[]>([])
  const [processingStats] = useState<ProcessingStats | null>(null)
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
    return saved ? parseInt(saved) : 6
  })
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectedTurn, setInspectedTurn] = useState<CleanedTurn | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  
  // Conversations modal state
  const [showConversationsModal, setShowConversationsModal] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [newConversationName, setNewConversationName] = useState('')
  const [newConversationDescription, setNewConversationDescription] = useState('')
  const [newConversationText, setNewConversationText] = useState('')
  
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

  // Close profile dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Don't close if clicking on the profile button or dropdown
      if (target.closest('[data-profile-dropdown]')) {
        return
      }
      if (showProfileDropdown) {
        setShowProfileDropdown(false)
      }
    }

    if (showProfileDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showProfileDropdown])
  
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
    const callId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    
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
      }) as any
      
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
        
        // First, add the turn in "processing" state so it appears in UI
        const processingTurn: CleanedTurn = {
          turn_id: `processing-${i}`,
          conversation_id: newConversationId,
          speaker: turn.speaker,
          raw_text: turn.raw_text,
          cleaned_text: turn.raw_text, // Show original text while processing
          processing_state: turn.speaker === 'Lumen' ? 'skipped' : 'processing',
          metadata: {
            confidence_score: 'PENDING',
            cleaning_applied: false,
            cleaning_level: 'none',
            corrections: [],
            context_detected: 'Processing...',
            processing_time_ms: 0,
            ai_model_used: settings.modelName
          },
          created_at: new Date().toISOString()
        }
        
        cleaned.push(processingTurn)
        setCleanedTurns([...cleaned])
        
        try {
          // Skip processing for Lumen turns
          if (turn.speaker === 'Lumen') {
            addDetailedLog(`⚡ Skipping Lumen turn ${i + 1} (bypass mode)`)
            // Update to completed state with no processing
            cleaned[cleaned.length - 1] = {
              ...processingTurn,
              processing_state: 'skipped',
              metadata: {
                ...processingTurn.metadata,
                confidence_score: 'BYPASS',
                context_detected: 'Lumen response - no processing needed'
              }
            }
            setCleanedTurns([...cleaned])
            continue
          }
          
          addDetailedLog(`🤖 Sending to Gemini 2.5 Flash-Lite...`)
          const turnStartTime = Date.now()
          
          // Call the turn processing endpoint
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
          }) as any
          
          const turnEndTime = Date.now()
          const turnProcessingTime = turnEndTime - turnStartTime
          
          addDetailedLog(`✅ Turn ${i + 1} processed in ${turnProcessingTime}ms`)
          addDetailedLog(`Cleaned text (${cleanResponse.cleaned_text.length} chars): "${cleanResponse.cleaned_text.substring(0, 100)}${cleanResponse.cleaned_text.length > 100 ? '...' : ''}"")`)
          addDetailedLog(`Confidence: ${cleanResponse.metadata.confidence_score} | Cleaning applied: ${cleanResponse.metadata.cleaning_applied}`)
          
          if (cleanResponse.metadata.corrections && cleanResponse.metadata.corrections.length > 0) {
            addDetailedLog(`🔧 Applied ${cleanResponse.metadata.corrections.length} corrections:`)
            cleanResponse.metadata.corrections.forEach((correction: any, idx: number) => {
              addDetailedLog(`  ${idx + 1}. "${correction.original}" → "${correction.corrected}" (${correction.reason})`)
            })
          }
          
          // Update the processing turn with completed results
          cleaned[cleaned.length - 1] = {
            ...cleanResponse,
            processing_state: 'completed'
          }
          setCleanedTurns([...cleaned])
          
          // Small delay for smooth UX
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (turnError) {
          addDetailedLog(`❌ Turn ${i + 1} failed: ${turnError}`)
          console.error(`Turn ${i + 1} failed:`, turnError)
          
          // Update the processing turn to show error state
          cleaned[cleaned.length - 1] = {
            ...processingTurn,
            processing_state: 'completed',
            cleaned_text: turn.raw_text, // Keep original text on error
            metadata: {
              confidence_score: 'ERROR',
              cleaning_applied: false,
              cleaning_level: 'none',
              corrections: [],
              context_detected: `Error: ${turnError}`,
              processing_time_ms: 0,
              ai_model_used: 'error'
            }
          }
          setCleanedTurns([...cleaned])
        }
      }
    } catch (error: any) {
      addDetailedLog(`❌ Cleaning process failed: ${error.message || error}`)
      console.error('Cleaning error:', error)
      alert(`Cleaning failed: ${error.message || error}`)
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
      addDetailedLog('🏁 Cleaning process completed')
    }
  }


  // Conversations management functions
  const loadConversations = async () => {
    try {
      setLoadingConversations(true)
      const response = await apiClient.get('/api/v1/conversations') as any
      setConversations(response.conversations || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  const createConversation = async () => {
    if (!newConversationName.trim() || !newConversationText.trim()) {
      alert('Please provide both name and conversation text')
      return
    }

    try {
      setLoadingConversations(true)
      
      // Step 1: Create the conversation
      const convResponse = await apiClient.post('/api/v1/conversations', {
        name: newConversationName,
        description: newConversationDescription,
        metadata: {
          source: 'manual_input',
          raw_transcript: newConversationText
        }
      })
      
      const conversationId = (convResponse as any).id
      addDetailedLog(`✅ Created conversation: ${newConversationName}`)
      
      // Step 2: Parse the transcript and save turns
      addDetailedLog(`🔄 Parsing transcript and saving turns...`)
      await apiClient.post(`/api/v1/conversations/${conversationId}/parse-transcript`, {
        raw_transcript: newConversationText
      })
      
      addDetailedLog(`✅ Transcript parsed and turns saved to database`)
      
      // Reset form
      setNewConversationName('')
      setNewConversationDescription('')
      setNewConversationText('')
      
      // Reload conversations to show updated turns_count
      await loadConversations()
      
      addDetailedLog(`🎉 Conversation created successfully with turns saved!`)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      alert('Failed to create conversation')
      addDetailedLog(`❌ Failed to create conversation: ${error}`)
    } finally {
      setLoadingConversations(false)
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return
    }

    try {
      setLoadingConversations(true)
      await apiClient.delete(`/api/v1/conversations/${conversationId}`)
      await loadConversations()
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      alert('Failed to delete conversation')
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadConversationToEditor = async (conversation: any) => {
    try {
      // Set the conversation ID and load its turns
      setConversationId(conversation.id)
      setShowConversationsModal(false)
      
      // Load turns from the database
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`) as any
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        // Convert turns to the format expected by the UI
        const turns = turnsResponse.turns.map((turn: any) => ({
          speaker: turn.speaker,
          raw_text: turn.raw_text,
          turn_index: turnsResponse.turns.indexOf(turn),
          original_speaker_label: turn.speaker,
          vt_tags: [],
          has_noise: false,
          has_foreign_text: false
        }))
        
        // Don't pre-populate results - they should only appear during actual cleaning
        setParsedTurns(turns)
        setCleanedTurns([])  // Keep results empty until cleaning starts
        // Don't auto-switch to results tab - let user decide when to start cleaning
        
        addDetailedLog(`✅ Loaded conversation: ${conversation.name} with ${turnsResponse.turns.length} turns`)
      } else {
        addDetailedLog(`⚠️ Conversation loaded but no turns found. Use the Conversations modal to add transcript content.`)
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      alert('Failed to load conversation')
    }
  }

  const openConversationsModal = () => {
    setShowConversationsModal(true)
    loadConversations()
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
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
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
              <a
                href="/prompt-engineering"
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  backgroundColor: theme.bgSecondary,
                  color: theme.text,
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.bgTertiary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.bgSecondary
                }}
              >
                🔧 Prompt Engineering
              </a>
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

              {/* Profile Dropdown */}
              {user && (
                <div style={{ position: 'relative' }} data-profile-dropdown>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('Profile button clicked, current state:', showProfileDropdown)
                      setShowProfileDropdown(!showProfileDropdown)
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      minWidth: '36px',
                      minHeight: '36px',
                      borderRadius: '50%',
                      backgroundColor: theme.bgSecondary,
                      border: `1px solid ${theme.border}`,
                      color: theme.text,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '500',
                      transition: 'all 0.15s ease',
                      padding: '0',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.bgTertiary
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.bgSecondary
                    }}
                  >
                    👤
                  </button>

                  {showProfileDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '40px',
                        right: '0',
                        backgroundColor: darkMode ? '#374151' : '#ffffff',
                        border: `2px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        boxShadow: darkMode
                          ? '0 8px 25px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)'
                          : '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
                        minWidth: '200px',
                        zIndex: 1000,
                        overflow: 'hidden'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>
                          {user.email}
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                          Signed in
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setShowProfileDropdown(false)
                          try {
                            if (logout) await logout()
                          } catch (error) {
                            console.error('Logout failed:', error)
                            localStorage.clear()
                            window.location.reload()
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.bgSecondary
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              onClick={openConversationsModal}
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
                cursor: 'pointer',
                gap: '6px'
              }}
            >
              💬 Conversations
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
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
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, margin: 0 }}>Conversation</h2>
            <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '4px', margin: 0 }}>
              {conversationId && parsedTurns.length > 0 
                ? `${parsedTurns.length} turns loaded • Ready for cleaning`
                : 'Load conversations through the Conversations modal'
              }
            </p>
          </div>
          
          <div style={{ 
            flex: 1, 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {conversationId && parsedTurns.length > 0 ? (
              // Show conversation turns
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '16px',
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.textMuted} transparent`
              }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {parsedTurns.map((turn, index) => (
                      <div key={index} style={{
                        padding: '10px 12px',
                        backgroundColor: theme.bgSecondary,
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: `1px solid ${theme.border}`,
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ 
                          fontWeight: '600', 
                          color: turn.speaker === 'Lumen' ? theme.accent : theme.text,
                          marginBottom: '6px',
                          fontSize: '13px'
                        }}>
                          #{index + 1} {turn.speaker}:
                        </div>
                        <div style={{ 
                          color: theme.textSecondary,
                          fontFamily: 'monospace',
                          lineHeight: '1.4',
                          fontSize: '11px',
                          wordBreak: 'break-word'
                        }}>
                          {turn.raw_text.substring(0, 200)}{turn.raw_text.length > 200 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            
            ) : (
              // Show instruction to load conversation
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                textAlign: 'center',
                padding: '40px 20px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: theme.text }}>
                  No Conversation Loaded
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: theme.textMuted, lineHeight: '1.5' }}>
                  Click the "💬 Conversations" button above to create a new conversation or load an existing one.
                </p>
                <button
                  onClick={openConversationsModal}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: theme.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  💬 Open Conversations
                </button>
              </div>
            )}
          </div>
          
          <div style={{ padding: '24px', borderTop: `1px solid ${theme.border}`, backgroundColor: theme.bgTertiary }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button 
                onClick={openConversationsModal}
                disabled={isProcessing}
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
                  backgroundColor: isProcessing ? theme.textMuted : theme.accent,
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                💬 Load Conversation
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
                {conversationId && parsedTurns.length > 0 ? (
                  <span>{parsedTurns.length} turns loaded</span>
                ) : (
                  <span>No conversation loaded</span>
                )}
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
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedTab === 'results' && (
              <>
                {/* Filter Controls - Fixed at top */}
                {cleanedTurns.length > 0 && (
                  <div style={{ 
                    padding: `${getSpacing(16)}px ${getSpacing(24)}px`,
                    borderBottom: `1px solid ${theme.border}`,
                    backgroundColor: theme.bg,
                    flexShrink: 0
                  }}>
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
                  </div>
                )}
                
                {/* Scrollable Content Area */}
                <div style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${theme.textMuted} transparent`
                }}>
                  <div style={{ 
                    padding: `${getSpacing(24)}px`, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: `${getSpacing(16)}px`, 
                    fontSize: getFontSize() 
                  }}>
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
                      {parsedTurns.length > 0 ? (
                        <>
                          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧹</div>
                          <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: theme.text }}>Ready to clean transcript</div>
                          <div style={{ fontSize: '14px', marginBottom: '20px' }}>
                            {parsedTurns.length} turns loaded. Click "Start Cleaning" to begin processing.
                          </div>
                          <div style={{ fontSize: '13px', color: theme.textMuted, fontStyle: 'italic' }}>
                            Results will appear here as each turn gets processed
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                          <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No results yet</div>
                          <div style={{ fontSize: '14px' }}>Load a conversation and start cleaning to see results here</div>
                        </>
                      )}
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
                      
                      // Render minimal card for skipped turns
                      if (turn.processing_state === 'skipped') {
                        return (
                          <div key={turn.turn_id} style={{ 
                            backgroundColor: theme.bgSecondary,
                            borderRadius: '8px', 
                            padding: `${getSpacing(16)}px`, 
                            border: `1px solid ${theme.border}`,
                            marginBottom: `${getSpacing(12)}px`,
                            opacity: 0.7
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '500', color: theme.textMuted }}>
                                Turn {index + 1}
                              </span>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '500',
                                backgroundColor: '#f3f4f6',
                                color: '#6b7280'
                              }}>
                                {turn.speaker}
                              </span>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '500',
                                backgroundColor: '#e0e7ff',
                                color: '#3730a3'
                              }}>
                                ⚡ Skipped
                              </span>
                              <span style={{ 
                                fontSize: '12px', 
                                color: theme.textMuted, 
                                fontStyle: 'italic',
                                flex: 1
                              }}>
                                {turn.raw_text.substring(0, 80)}{turn.raw_text.length > 80 ? '...' : ''}
                              </span>
                            </div>
                          </div>
                        )
                      }
                      
                      // Render full card for processed turns
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
                                title={
                                  turn.metadata.confidence_score === 'PENDING' ? 'Processing...' :
                                  turn.metadata.confidence_score === 'BYPASS' ? 'Lumen response - no processing needed' :
                                  turn.metadata.confidence_score === 'ERROR' ? 'Processing failed' :
                                  turn.metadata.confidence_score === 'HIGH' ? 'Very confident in cleaning quality' : 
                                  turn.metadata.confidence_score === 'MEDIUM' ? 'Moderately confident' : 'Low confidence - review recommended'
                                }
                                style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: 
                                  turn.metadata.confidence_score === 'PENDING' ? '#f3f4f6' :
                                  turn.metadata.confidence_score === 'BYPASS' ? '#e0e7ff' :
                                  turn.metadata.confidence_score === 'ERROR' ? '#fee2e2' :
                                  turn.metadata.confidence_score === 'HIGH' ? '#dcfce7' : 
                                  turn.metadata.confidence_score === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
                                color: 
                                  turn.metadata.confidence_score === 'PENDING' ? '#6b7280' :
                                  turn.metadata.confidence_score === 'BYPASS' ? '#3730a3' :
                                  turn.metadata.confidence_score === 'ERROR' ? '#dc2626' :
                                  turn.metadata.confidence_score === 'HIGH' ? '#166534' : 
                                  turn.metadata.confidence_score === 'MEDIUM' ? '#92400e' : '#991b1b',
                                cursor: 'help'
                              }}>
                                {turn.processing_state === 'processing' && (
                                  <span style={{ marginRight: '4px' }}>⏳</span>
                                )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {settings.showTimings && (
                                <span style={{ fontSize: '14px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                  {turn.metadata.processing_time_ms.toFixed(1)}ms
                                </span>
                              )}
                              {turn.speaker === 'User' && turn.metadata.ai_model_used && (
                                <button
                                  onClick={() => {
                                    setInspectedTurn(turn)
                                    setInspectorOpen(true)
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    backgroundColor: theme.bgSecondary,
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '4px',
                                    color: theme.text,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Inspect Gemini Query"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.bgTertiary
                                    e.currentTarget.style.borderColor = theme.textMuted
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.bgSecondary
                                    e.currentTarget.style.borderColor = theme.border
                                  }}
                                >
                                  🔍 Inspect
                                </button>
                              )}
                            </div>
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
                          
                          {/* Content Display - varies based on processing state */}
                          {turn.processing_state === 'processing' ? (
                            // Show processing state with single panel
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ 
                                backgroundColor: theme.bgTertiary, 
                                borderRadius: '6px', 
                                padding: '16px',
                                border: `2px solid ${theme.accent}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                              }}>
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  border: `3px solid ${theme.accent}`,
                                  borderTopColor: 'transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontSize: '12px', 
                                    fontWeight: '600', 
                                    color: theme.accent, 
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '8px' 
                                  }}>
                                    PROCESSING WITH GEMINI...
                                  </div>
                                  <div style={{ 
                                    color: theme.textSecondary, 
                                    lineHeight: '1.6', 
                                    fontSize: '14px',
                                    wordBreak: 'break-word'
                                  }}>
                                    {turn.raw_text}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Show side-by-side comparison for completed processing
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
                                  ORIGINAL TEXT
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
                              
                              {/* Cleaned Text - only show if actually processed */}
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
                                  {turn.metadata.cleaning_applied ? 'CLEANED RESULT' : 'NO CLEANING NEEDED'}
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
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span>{turn.cleaned_text.length} chars</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: turn.metadata.cleaning_applied ? '#10b981' : theme.textMuted }}>
                                      {turn.metadata.processing_time_ms.toFixed(1)}ms
                                    </span>
                                    {turn.speaker === 'User' && turn.metadata.ai_model_used && (
                                      <button
                                        onClick={() => {
                                          setInspectedTurn(turn)
                                          setInspectorOpen(true)
                                        }}
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          backgroundColor: theme.bgSecondary,
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: '3px',
                                          color: theme.text,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                        title="Inspect Gemini Query"
                                      >
                                        🔍
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
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
              </>
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
      
      {/* Gemini Query Inspector Modal */}
      {inspectorOpen && inspectedTurn && conversationId && (
        <GeminiQueryInspector
          conversationId={conversationId}
          turnId={inspectedTurn.turn_id}
          turnData={inspectedTurn}
          isOpen={inspectorOpen}
          onClose={() => {
            setInspectorOpen(false)
            setInspectedTurn(null)
          }}
          darkMode={darkMode}
        />
      )}

      {/* Conversations Modal */}
      {showConversationsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.bg,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            width: '90%',
            maxWidth: '1000px',
            height: '80vh',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: theme.text }}>
                💬 Conversations Manager
              </h2>
              <button
                onClick={() => setShowConversationsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: theme.textMuted,
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left Panel - Create New */}
              <div style={{
                width: '40%',
                borderRight: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '20px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${theme.textMuted} transparent`
                }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: theme.text }}>
                  Create New Conversation
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '6px' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newConversationName}
                    onChange={(e) => setNewConversationName(e.target.value)}
                    placeholder="Enter conversation name..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: theme.bgSecondary,
                      color: theme.text
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '6px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={newConversationDescription}
                    onChange={(e) => setNewConversationDescription(e.target.value)}
                    placeholder="Optional description..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: theme.bgSecondary,
                      color: theme.text
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '6px' }}>
                    Conversation Text *
                  </label>
                  <textarea
                    value={newConversationText}
                    onChange={(e) => setNewConversationText(e.target.value)}
                    placeholder="Paste your conversation transcript here..."
                    style={{
                      width: '100%',
                      height: '200px',
                      padding: '12px',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: theme.bgSecondary,
                      color: theme.text,
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button
                  onClick={createConversation}
                  disabled={loadingConversations || !newConversationName.trim() || !newConversationText.trim()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: theme.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loadingConversations ? 'not-allowed' : 'pointer',
                    opacity: (loadingConversations || !newConversationName.trim() || !newConversationText.trim()) ? 0.5 : 1
                  }}
                >
                  {loadingConversations ? 'Creating...' : '💾 Save Conversation'}
                </button>
                </div>
              </div>

              {/* Right Panel - Existing Conversations */}
              <div style={{
                width: '60%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '20px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${theme.textMuted} transparent`
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: theme.text }}>
                    Existing Conversations ({conversations.length})
                  </h3>
                  <button
                    onClick={loadConversations}
                    disabled={loadingConversations}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: theme.bgTertiary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: theme.textSecondary,
                      cursor: loadingConversations ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loadingConversations ? '🔄' : '🔄 Refresh'}
                  </button>
                </div>

                {loadingConversations ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: theme.textMuted }}>
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: theme.textMuted }}>
                    No conversations found. Create your first one!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: theme.bgSecondary
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: theme.text }}>
                              {conversation.name}
                            </h4>
                            {conversation.description && (
                              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: theme.textMuted }}>
                                {conversation.description}
                              </p>
                            )}
                            <div style={{ fontSize: '11px', color: theme.textMuted }}>
                              Created: {new Date(conversation.created_at).toLocaleDateString()} • 
                              Turns: {conversation.turns_count || 0}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            onClick={() => loadConversationToEditor(conversation)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: theme.accent,
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            📥 Load
                          </button>
                          <button
                            onClick={() => deleteConversation(conversation.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}