import React, { useState } from 'react'
import { apiClient } from '../lib/api'
import { GeminiQueryInspector } from '../components/GeminiQueryInspector'

interface ParsedTurn {
  speaker: string
  raw_text: string
  turn_index: number  // Keep for compatibility, but will use turn_sequence for display
  turn_sequence: number  // Actual sequence number from backend (1, 2, 3, ...)
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
  turn_sequence?: number  // Actual sequence number from backend (1, 2, 3, ...)
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

interface TurnAPIGroup {
  turnIndex: number
  turnSequence: number
  speaker: string
  rawText: string
  frontendRequest: APICall
  backendResponse: APICall
  geminiFunctionCall?: {
    function_call: string
    model_config: any
    prompt: string
    response: string
    timestamp: number
    success: boolean
  }
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
  const [turnAPIGroups, setTurnAPIGroups] = useState<TurnAPIGroup[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null)
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
  const [conversationEvaluations, setConversationEvaluations] = useState<{[key: string]: any[]}>({})
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [newConversationName, setNewConversationName] = useState('')
  const [newConversationDescription, setNewConversationDescription] = useState('')
  const [newConversationText, setNewConversationText] = useState('')

  // Evaluations modal state
  const [showEvaluationsModal, setShowEvaluationsModal] = useState(false)
  const [selectedConversationForEvaluations, setSelectedConversationForEvaluations] = useState<any>(null)
  
  // Prompt template state
  const [promptTemplates, setPromptTemplates] = useState<any[]>([])
  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)

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
      slidingWindow: 5,
      // Prompt Template
      promptTemplate: null
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

  // Load prompt templates from backend
  const loadPromptTemplates = async () => {
    try {
      setLoadingTemplates(true)
      addDetailedLog('📜 Loading prompt templates...')
      
      const response = await apiCallWithLogging('GET', '/api/v1/prompt-engineering/templates') as any
      const templates = Array.isArray(response) ? response : []
      setPromptTemplates(templates)
      
      addDetailedLog(`✅ Loaded ${templates.length} prompt templates`)
    } catch (error: any) {
      addDetailedLog(`❌ Failed to load templates: ${error.message}`)
      // Fallback templates for demo
      setPromptTemplates([
        {
          id: 'default',
          name: 'Default CleanerContext Template',
          description: 'The original system prompt for conversation cleaning',
          template: 'You are an expert conversation cleaner...',
          variables: ['conversation_context', 'raw_text', 'cleaning_level']
        }
      ])
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId)
    if (template) {
      setSettings({...settings, promptTemplate: template})
      setSelectedTemplatePreview(template.template)
      addDetailedLog(`🎯 Selected template: ${template.name}`)
    } else {
      setSettings({...settings, promptTemplate: null})
      setSelectedTemplatePreview('')
    }
  }

  // Load templates on component mount
  React.useEffect(() => {
    loadPromptTemplates()
  }, [])


  const startCleaning = async () => {
    if (!conversationId) {
      addDetailedLog(`❌ Cannot start cleaning: No conversation selected`)
      return
    }

    addDetailedLog(`🧹 Starting evaluation-based cleaning for conversation: ${conversationId}`)

    setIsProcessing(true)
    setCleanedTurns([])
    setTurnAPIGroups([])
    setCurrentTurnIndex(0)
    setSelectedTab('results')
    
    try {
      // Step 1: Create a new evaluation for this cleaning session
      addDetailedLog('📋 Creating new evaluation...')
      if (settings.promptTemplate) {
        addDetailedLog(`🎯 Using prompt template: ${settings.promptTemplate.name}`)
      } else {
        addDetailedLog('📝 Using default system prompt')
      }
      const evaluationName = `Evaluation ${new Date().toLocaleString()}`
      const evaluationData = {
        name: evaluationName,
        description: `Auto-created evaluation with ${settings.cleaningLevel} cleaning`,
        prompt_template_id: settings.promptTemplate?.id || null,
        settings: {
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
      }
      
      const evaluationResponse = await apiCallWithLogging('POST', `/api/v1/evaluations/conversations/${conversationId}/evaluations`, evaluationData) as any
      const evaluationId = evaluationResponse.id
      setCurrentEvaluationId(evaluationId)
      addDetailedLog(`✅ Created evaluation: ${evaluationName} (${evaluationId})`)
      
      // Step 2: Get raw turns from the conversation
      addDetailedLog('🔍 Fetching raw turns from conversation...')
      const turnsResponse = await apiCallWithLogging('GET', `/api/v1/conversations/${conversationId}/turns`) as any
      const rawTurns = turnsResponse.turns || []
      addDetailedLog(`📊 Found ${rawTurns.length} raw turns to process`)
      
      // Set the raw turns for display in the conversation component
      const parsedRawTurns: ParsedTurn[] = rawTurns.map((turn: any, index: number) => ({
        speaker: turn.speaker,
        raw_text: turn.raw_text,
        turn_index: index,
        turn_sequence: turn.turn_sequence || index + 1,
        original_speaker_label: turn.speaker,
        vt_tags: [],
        has_noise: false,
        has_foreign_text: false
      }))
      setParsedTurns(parsedRawTurns)
      addDetailedLog(`✅ Loaded ${parsedRawTurns.length} raw turns for display`)
      
      // Step 3: Process turns individually for real-time progress tracking
      addDetailedLog(`🚀 Processing ${rawTurns.length} turns individually with real-time updates...`)
      addDetailedLog(`Sliding window: ${settings.slidingWindow} turns | Cleaning level: ${settings.cleaningLevel}`)
      addDetailedLog(`🔄 REAL-TIME MODE: Processing each turn individually`)
      
      const processedTurns: CleanedTurn[] = []
      
      for (let i = 0; i < rawTurns.length; i++) {
        const rawTurn = rawTurns[i]
        
        // Update progress UI in real-time
        setCurrentTurnIndex(i)
        addDetailedLog(`Processing turn ${i + 1}/${rawTurns.length}: ${rawTurn.speaker}`)
        
        // Process individual turn with API call
        const turnResult = await apiCallWithLogging('POST', `/api/v1/evaluations/${evaluationId}/process-turn`, {
          turn_id: rawTurn.id
        }) as any
        
        // Convert to UI format
        const cleanedTurn: CleanedTurn = {
          turn_id: turnResult.turn_id,
          conversation_id: conversationId,
          speaker: turnResult.raw_speaker,
          raw_text: turnResult.raw_text,
          cleaned_text: turnResult.cleaned_text,
          turn_sequence: turnResult.turn_sequence,
          processing_state: 'completed',
          metadata: {
            confidence_score: turnResult.confidence_score,
            cleaning_applied: turnResult.cleaning_applied,
            cleaning_level: turnResult.cleaning_level,
            timing_breakdown: turnResult.timing_breakdown,
            corrections: turnResult.corrections || [],
            context_detected: turnResult.context_detected,
            processing_time_ms: turnResult.processing_time_ms,
            ai_model_used: turnResult.ai_model_used,
            gemini_prompt: turnResult.gemini_prompt,
            gemini_response: turnResult.gemini_response
          },
          created_at: turnResult.created_at
        }
        
        // Create turn API group
        console.log('[DEBUG] Creating turnAPIGroup with turnResult:', turnResult);
        console.log('[DEBUG] turnResult.gemini_function_call:', turnResult.gemini_function_call);
        console.log('[DEBUG] Latest API call:', apiCalls[apiCalls.length - 1]);
        
        const turnAPIGroup: TurnAPIGroup = {
          turnIndex: i,
          turnSequence: rawTurn.turn_sequence,
          speaker: rawTurn.speaker,
          rawText: rawTurn.raw_text,
          frontendRequest: apiCalls[apiCalls.length - 1], // Last API call is the frontend request
          backendResponse: {
            ...apiCalls[apiCalls.length - 1],
            response_data: turnResult
          },
          geminiFunctionCall: turnResult.gemini_function_call ? {
            function_call: turnResult.gemini_function_call.function_call,
            model_config: turnResult.gemini_function_call.model_config,
            prompt: turnResult.gemini_function_call.prompt,
            response: turnResult.gemini_function_call.response,
            timestamp: turnResult.gemini_function_call.timestamp,
            success: turnResult.gemini_function_call.success
          } : undefined
        }
        
        setTurnAPIGroups(prev => [...prev, turnAPIGroup])
        processedTurns.push(cleanedTurn)
        
        // Update UI immediately with current progress
        setCleanedTurns([...processedTurns])
        
        addDetailedLog(`✅ Turn ${i + 1} completed: ${rawTurn.speaker}`)
      }
      
      // Final update - all turns are already in cleanedTurns from real-time processing
      addDetailedLog(`🎉 Real-time processing completed! ${processedTurns.length} turns processed and displayed`)
      
      // All processing is handled by the evaluation system automatically!
      
    
    } catch (error: any) {
      addDetailedLog(`❌ Cleaning process failed: ${error.message || error}`)
      console.error('Cleaning error:', error)
      alert(`Cleaning failed: ${error.message || error}`)
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
      setCurrentEvaluationId(null)
      addDetailedLog('🏁 Cleaning process completed')
    }
  }

  const stopCleaning = async () => {
    if (!currentEvaluationId) {
      addDetailedLog(`❌ Cannot stop cleaning: No active evaluation`)
      return
    }

    addDetailedLog(`⏹️ Stopping evaluation: ${currentEvaluationId}`)
    
    try {
      await apiCallWithLogging('POST', `/api/v1/evaluations/${currentEvaluationId}/stop`, {}) as any
      addDetailedLog(`✅ Evaluation stopped successfully`)
      
      // Keep the processing state but update the UI
      setIsProcessing(false)
      setCurrentEvaluationId(null)
      
    } catch (error: any) {
      addDetailedLog(`❌ Failed to stop evaluation: ${error.message || error}`)
      console.error('Stop error:', error)
      alert(`Failed to stop evaluation: ${error.message || error}`)
    }
  }


  // Conversations management functions
  const loadConversations = async () => {
    try {
      setLoadingConversations(true)
      const response = await apiClient.get('/api/v1/conversations') as any
      const conversationList = response.conversations || []
      setConversations(conversationList)
      
      // Load evaluations for each conversation
      const evaluationData: {[key: string]: any[]} = {}
      for (const conversation of conversationList) {
        try {
          const evaluationsResponse = await apiClient.getEvaluations(conversation.id) as any
          evaluationData[conversation.id] = evaluationsResponse.evaluations || []
        } catch (error) {
          console.error(`Failed to load evaluations for conversation ${conversation.id}:`, error)
          evaluationData[conversation.id] = []
        }
      }
      setConversationEvaluations(evaluationData)
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



  const openConversationsModal = () => {
    setShowConversationsModal(true)
    loadConversations()
  }

  const openEvaluationsModal = (conversation: any) => {
    setSelectedConversationForEvaluations(conversation)
    setShowEvaluationsModal(true)
  }

  // NOTE: Save functions removed - evaluations auto-save during processing

  const loadLatestEvaluation = async (conversation: any) => {
    try {
      const evaluations = conversationEvaluations[conversation.id] || []
      if (evaluations.length === 0) {
        alert('No evaluations found for this conversation')
        return
      }
      
      // Get the most recent evaluation
      const latestEvaluation = evaluations[0] // Evaluations should be sorted by created_at desc
      addDetailedLog(`📊 Loading latest evaluation: ${latestEvaluation.name}`)
      
      // Load evaluation details including cleaned turns
      const evaluationDetails = await apiClient.getEvaluationDetails(latestEvaluation.id) as any
      
      // Set conversation context
      setConversationId(conversation.id)
      setShowConversationsModal(false)
      
      // Convert evaluation cleaned turns to UI format
      const cleaned: CleanedTurn[] = evaluationDetails.cleaned_turns.map((cleanedTurn: any) => ({
        turn_id: cleanedTurn.turn_id,
        conversation_id: conversation.id,
        speaker: cleanedTurn.raw_speaker,
        raw_text: cleanedTurn.raw_text,
        cleaned_text: cleanedTurn.cleaned_text,
        turn_sequence: cleanedTurn.turn_sequence,  // Use actual sequence from backend
        processing_state: 'completed',
        metadata: {
          confidence_score: cleanedTurn.confidence_score,
          cleaning_applied: cleanedTurn.cleaning_applied,
          cleaning_level: cleanedTurn.cleaning_level,
          corrections: cleanedTurn.corrections,
          context_detected: cleanedTurn.context_detected,
          processing_time_ms: cleanedTurn.processing_time_ms,
          ai_model_used: cleanedTurn.ai_model_used
        },
        created_at: cleanedTurn.created_at
      }))
      
      setCleanedTurns(cleaned)
      setSelectedTab('results')
      addDetailedLog(`✅ Loaded ${cleaned.length} cleaned turns from evaluation: ${latestEvaluation.name}`)
      
    } catch (error) {
      console.error('Failed to load latest evaluation:', error)
      alert('Failed to load latest evaluation')
    }
  }
  
  const loadSpecificEvaluation = async (evaluation: any, conversation: any) => {
    try {
      addDetailedLog(`📊 Loading specific evaluation: ${evaluation.name}`)
      
      // Load evaluation details including cleaned turns
      const evaluationDetails = await apiClient.getEvaluationDetails(evaluation.id) as any
      
      // Set conversation context
      setConversationId(conversation.id)
      setShowEvaluationsModal(false)
      
      // Load raw turns for the conversation component
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`) as any
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        const turns = turnsResponse.turns.map((turn: any) => ({
          speaker: turn.speaker,
          raw_text: turn.raw_text,
          turn_index: turnsResponse.turns.indexOf(turn),  // Keep for compatibility
          turn_sequence: turn.turn_sequence,  // Use actual sequence from backend
          original_speaker_label: turn.speaker,
          vt_tags: [],
          has_noise: false,
          has_foreign_text: false
        }))
        
        setParsedTurns(turns)
        addDetailedLog(`✅ Loaded ${turns.length} raw turns for conversation display`)
      }
      
      // Convert evaluation cleaned turns to UI format
      const cleaned: CleanedTurn[] = evaluationDetails.cleaned_turns.map((cleanedTurn: any) => ({
        turn_id: cleanedTurn.turn_id,
        conversation_id: conversation.id,
        speaker: cleanedTurn.raw_speaker,
        raw_text: cleanedTurn.raw_text,
        cleaned_text: cleanedTurn.cleaned_text,
        turn_sequence: cleanedTurn.turn_sequence,  // Use actual sequence from backend
        processing_state: 'completed',
        metadata: {
          confidence_score: cleanedTurn.confidence_score,
          cleaning_applied: cleanedTurn.cleaning_applied,
          cleaning_level: cleanedTurn.cleaning_level,
          corrections: cleanedTurn.corrections,
          context_detected: cleanedTurn.context_detected,
          processing_time_ms: cleanedTurn.processing_time_ms,
          ai_model_used: cleanedTurn.ai_model_used
        },
        created_at: cleanedTurn.created_at
      }))
      
      setCleanedTurns(cleaned)
      setSelectedTab('results')
      addDetailedLog(`✅ Loaded ${cleaned.length} cleaned turns from evaluation: ${evaluation.name}`)
      
    } catch (error) {
      console.error('Failed to load specific evaluation:', error)
      alert('Failed to load evaluation')
    }
  }
  
  const startNewEvaluation = async (conversation: any) => {
    try {
      // Set conversation context and load raw turns
      setConversationId(conversation.id)
      setShowConversationsModal(false)
      
      // Load raw turns
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`) as any
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        const turns = turnsResponse.turns.map((turn: any) => ({
          speaker: turn.speaker,
          raw_text: turn.raw_text,
          turn_index: turnsResponse.turns.indexOf(turn),  // Keep for compatibility
          turn_sequence: turn.turn_sequence,  // Use actual sequence from backend
          original_speaker_label: turn.speaker,
          vt_tags: [],
          has_noise: false,
          has_foreign_text: false
        }))
        
        setParsedTurns(turns)
        setCleanedTurns([]) // Clear any existing results
        addDetailedLog(`✅ Loaded conversation: ${conversation.name} with ${turnsResponse.turns.length} turns - ready for new evaluation`)
      }
    } catch (error) {
      console.error('Failed to start new evaluation:', error)
      alert('Failed to start new evaluation')
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
                          #{turn.turn_sequence} {turn.speaker}:
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
                onClick={isProcessing ? stopCleaning : startCleaning}
                disabled={parsedTurns.length === 0 && !isProcessing}
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
                  backgroundColor: isProcessing ? '#ef4444' : (parsedTurns.length === 0 ? '#9ca3af' : '#10b981'),
                  cursor: (parsedTurns.length === 0 && !isProcessing) ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? '⏹️ Stop Cleaning' : 'Start Cleaning'}
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
                { key: 'api', label: 'API Calls', count: turnAPIGroups.length },
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
                    {/* Evaluation Status - Show when processing is complete */}
                    {!isProcessing && cleanedTurns.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginBottom: '16px',
                        padding: '16px', 
                        backgroundColor: '#f0fdf4', 
                        borderRadius: '8px', 
                        border: '2px solid #10b981',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                            ✅ Evaluation Complete!
                          </div>
                          <div style={{ fontSize: '14px', color: '#16a34a' }}>
                            All cleaned turns have been automatically saved to the evaluation database.
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Filter Controls */}
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
                          Processing Turn {parsedTurns[currentTurnIndex]?.turn_sequence || currentTurnIndex + 1} of {parsedTurns.length}
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
                                Turn {turn.turn_sequence || index + 1}
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
                                Turn {turn.turn_sequence || index + 1}
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
                  {turnAPIGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: theme.textMuted }}>
                      <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No turn API calls yet</div>
                      <div style={{ fontSize: '14px' }}>Turn-based API requests will appear here as they happen</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {turnAPIGroups.map((turnGroup) => (
                        <div key={`turn-${turnGroup.turnIndex}`} style={{ backgroundColor: theme.bgSecondary, borderRadius: '8px', padding: '24px', border: `1px solid ${theme.border}` }}>
                          {/* Turn Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${theme.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                backgroundColor: theme.accent,
                                color: 'white'
                              }}>
                                Turn {turnGroup.turnSequence}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>
                                {turnGroup.speaker}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: theme.textMuted }}>
                              {turnGroup.rawText.length > 50 ? `${turnGroup.rawText.substring(0, 50)}...` : turnGroup.rawText}
                            </span>
                          </div>

                          {/* Simple API Flow Display */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>API Flow:</div>
                            <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                              1. Frontend → Backend: {turnGroup.frontendRequest.method} {turnGroup.frontendRequest.endpoint} ({turnGroup.frontendRequest.latency_ms}ms)
                            </div>
                            {turnGroup.geminiFunctionCall && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                2. Backend → Google: {turnGroup.geminiFunctionCall.function_call} ({turnGroup.geminiFunctionCall.model_config.model_name})
                              </div>
                            )}
                            {turnGroup.geminiFunctionCall && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                3. Google → Backend: Response received (success: {turnGroup.geminiFunctionCall.success ? 'true' : 'false'})
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                              4. Backend → Frontend: {turnGroup.backendResponse.status} ({turnGroup.backendResponse.latency_ms}ms)
                            </div>
                          </div>

                          {/* Four Separate Dropdowns for API Detail Levels */}
                          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            
                            {/* 1. Frontend Request */}
                            <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                              <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                🔵 1. Frontend Request
                              </summary>
                              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '4px' }}>
                                <pre style={{ 
                                  fontSize: '11px', 
                                  fontFamily: 'monospace', 
                                  color: theme.text,
                                  margin: 0,
                                  overflowX: 'auto',
                                  maxHeight: '150px'
                                }}>
                                  {JSON.stringify({
                                    method: turnGroup.frontendRequest.method,
                                    endpoint: turnGroup.frontendRequest.endpoint,
                                    latency_ms: turnGroup.frontendRequest.latency_ms,
                                    timestamp: turnGroup.frontendRequest.timestamp,
                                    request_payload: turnGroup.frontendRequest.request_data || 'No request data'
                                  }, null, 2)}
                                </pre>
                              </div>
                            </details>

                            {/* 2. Backend Processing */}
                            <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                              <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                🟠 2. Backend Processing
                              </summary>
                              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '4px' }}>
                                <pre style={{ 
                                  fontSize: '11px', 
                                  fontFamily: 'monospace', 
                                  color: theme.text,
                                  margin: 0,
                                  overflowX: 'auto',
                                  maxHeight: '150px'
                                }}>
                                  {JSON.stringify({
                                    processing_time_ms: turnGroup.backendResponse.response_data?.metadata?.processing_time_ms || 'N/A',
                                    timing_breakdown: turnGroup.backendResponse.response_data?.timing_breakdown || 'No timing data',
                                    ai_model_used: turnGroup.backendResponse.response_data?.metadata?.ai_model_used || 'N/A',
                                    cleaning_level: turnGroup.backendResponse.response_data?.metadata?.cleaning_level || 'N/A',
                                    confidence_score: turnGroup.backendResponse.response_data?.metadata?.confidence_score || 'N/A'
                                  }, null, 2)}
                                </pre>
                              </div>
                            </details>

                            {/* 3. Gemini API Call */}
                            {turnGroup.geminiFunctionCall && (
                              <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                                <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                  🟢 3. Gemini API Call
                                </summary>
                                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '4px' }}>
                                  <pre style={{ 
                                    fontSize: '11px', 
                                    fontFamily: 'monospace', 
                                    color: theme.text,
                                    margin: 0,
                                    overflowX: 'auto',
                                    maxHeight: '150px'
                                  }}>
                                    {JSON.stringify({
                                      function_call: turnGroup.geminiFunctionCall.function_call,
                                      model_config: turnGroup.geminiFunctionCall.model_config,
                                      success: turnGroup.geminiFunctionCall.success,
                                      timestamp: turnGroup.geminiFunctionCall.timestamp,
                                      prompt_preview: turnGroup.geminiFunctionCall.prompt?.substring(0, 200) + '...' || 'No prompt',
                                      response_preview: turnGroup.geminiFunctionCall.response?.substring(0, 200) + '...' || 'No response'
                                    }, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}

                            {/* 4. Backend Response */}
                            <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                              <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                🔴 4. Backend Response
                              </summary>
                              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '4px' }}>
                                <pre style={{ 
                                  fontSize: '11px', 
                                  fontFamily: 'monospace', 
                                  color: theme.text,
                                  margin: 0,
                                  overflowX: 'auto',
                                  maxHeight: '150px'
                                }}>
                                  {JSON.stringify({
                                    status: turnGroup.backendResponse.status,
                                    latency_ms: turnGroup.backendResponse.latency_ms,
                                    cleaned_text: turnGroup.backendResponse.response_data?.cleaned_text || 'No cleaned text',
                                    corrections: turnGroup.backendResponse.response_data?.metadata?.corrections || [],
                                    context_detected: turnGroup.backendResponse.response_data?.metadata?.context_detected || 'N/A',
                                    gemini_prompt: turnGroup.backendResponse.response_data?.gemini_prompt?.substring(0, 200) + '...' || 'No prompt',
                                    gemini_response: turnGroup.backendResponse.response_data?.gemini_response?.substring(0, 200) + '...' || 'No response'
                                  }, null, 2)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </div>
                      ))}
                      
                      <div style={{ paddingTop: '16px' }}>
                        <button 
                          onClick={() => setTurnAPIGroups([])}
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
                          Clear Turn API Log
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
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                              Prompt Template
                            </label>
                            <select 
                              value={settings.promptTemplate?.id || ''}
                              onChange={(e) => handleTemplateChange(e.target.value)}
                              disabled={loadingTemplates}
                              style={{ 
                                display: 'block', 
                                width: '100%', 
                                borderRadius: '6px', 
                                border: `1px solid ${theme.border}`, 
                                padding: '8px 12px',
                                backgroundColor: theme.bg,
                                color: theme.text,
                                fontSize: '14px'
                              }}
                            >
                              <option value="">Default System Prompt</option>
                              {promptTemplates.map(template => (
                                <option key={template.id} value={template.id}>
                                  {template.name} ({template.variables?.length || 0} variables)
                                </option>
                              ))}
                            </select>
                            {loadingTemplates && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                                Loading templates...
                              </div>
                            )}
                            {settings.promptTemplate && (
                              <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: theme.textSecondary, marginBottom: '4px' }}>
                                  Template Preview:
                                </div>
                                <textarea
                                  value={selectedTemplatePreview}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    height: '120px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.border}`,
                                    padding: '8px 12px',
                                    backgroundColor: theme.bgSecondary,
                                    color: theme.text,
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    resize: 'vertical',
                                    lineHeight: '1.4'
                                  }}
                                />
                                <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '4px' }}>
                                  Variables: {settings.promptTemplate.variables?.join(', ') || 'None'}
                                </div>
                              </div>
                            )}
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
          }}        />
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
                        
                        {/* Evaluation Info and Actions */}
                        {(() => {
                          const evaluations = conversationEvaluations[conversation.id] || []
                          const hasEvaluations = evaluations.length > 0
                          const latestEvaluation = hasEvaluations ? evaluations[0] : null
                          
                          return (
                            <div>
                              {/* Evaluation Status */}
                              <div style={{ 
                                fontSize: '12px', 
                                color: theme.textMuted, 
                                marginBottom: '8px',
                                fontStyle: 'italic'
                              }}>
                                {hasEvaluations ? (
                                  `${evaluations.length} evaluation${evaluations.length > 1 ? 's' : ''}, last: ${new Date(latestEvaluation.created_at).toLocaleString()}`
                                ) : (
                                  'No evaluations'
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                {hasEvaluations && (
                                  <button
                                    onClick={() => loadLatestEvaluation(conversation)}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: theme.accent,
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      flex: 1
                                    }}
                                  >
                                    📊 Load Latest
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => startNewEvaluation(conversation)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: hasEvaluations ? theme.bgTertiary : '#10b981',
                                    color: hasEvaluations ? theme.text : 'white',
                                    border: hasEvaluations ? `1px solid ${theme.border}` : 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    flex: 1
                                  }}
                                >
                                  🧪 Start New
                                </button>

                                {hasEvaluations && (
                                  <button
                                    onClick={() => openEvaluationsModal(conversation)}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: theme.bgTertiary,
                                      color: theme.text,
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    📋 View All
                                  </button>
                                )}

                              </div>
                              
                              {/* Delete button */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => deleteConversation(conversation.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: 'transparent',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          )
                        })()}
                        
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

      {/* Evaluations Modal */}
      {showEvaluationsModal && selectedConversationForEvaluations && (
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
            padding: '32px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            border: `1px solid ${theme.border}`,
            boxShadow: darkMode
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
              : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: theme.text, margin: 0 }}>
                Evaluations for "{selectedConversationForEvaluations.name}"
              </h2>
              <button
                onClick={() => setShowEvaluationsModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  color: theme.text,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '14px', color: theme.textMuted }}>
              {conversationEvaluations[selectedConversationForEvaluations.id]?.length || 0} evaluations found
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(conversationEvaluations[selectedConversationForEvaluations.id] || []).map((evaluation: any) => (
                <div key={evaluation.id} style={{
                  padding: '20px',
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, margin: '0 0 8px 0' }}>
                        {evaluation.name}
                      </h3>
                      <p style={{ fontSize: '14px', color: theme.textMuted, margin: 0 }}>
                        {evaluation.description || 'No description'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          try {
                            await loadSpecificEvaluation(evaluation, selectedConversationForEvaluations)
                          } catch (error) {
                            console.error('Failed to load evaluation:', error)
                          }
                        }}
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
                        📊 Load
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete evaluation "${evaluation.name}"?`)) {
                            try {
                              await apiClient.deleteEvaluation(evaluation.id)
                              // Refresh evaluations
                              const evaluationsResponse = await apiClient.getEvaluations(selectedConversationForEvaluations.id) as any
                              setConversationEvaluations(prev => ({
                                ...prev,
                                [selectedConversationForEvaluations.id]: evaluationsResponse.evaluations || []
                              }))
                              addDetailedLog(`🗑️ Deleted evaluation: ${evaluation.name}`)
                            } catch (error) {
                              console.error('Failed to delete evaluation:', error)
                              alert('Failed to delete evaluation')
                            }
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
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

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: theme.textMuted }}>
                    <span>Created: {new Date(evaluation.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>Settings: {evaluation.settings?.cleaning_level || 'unknown'} cleaning</span>
                    {evaluation.settings?.model_params?.model_name && (
                      <>
                        <span>•</span>
                        <span>Model: {evaluation.settings.model_params.model_name}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {(!conversationEvaluations[selectedConversationForEvaluations.id] || conversationEvaluations[selectedConversationForEvaluations.id].length === 0) && (
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  color: theme.textMuted,
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No evaluations yet</div>
                  <div style={{ fontSize: '14px' }}>Create your first evaluation by clicking "Start New"</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}