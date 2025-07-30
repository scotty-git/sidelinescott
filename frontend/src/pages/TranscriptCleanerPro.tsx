import React, { useState } from 'react'
import { apiClient } from '../lib/api' // TypeScript refresh
import { GeminiQueryInspector } from '../components/GeminiQueryInspector'
import { VariableInput } from '../components/VariableInput'
import { CustomerModal } from '../components/CustomerModal'
import { EvaluationConfigModal } from '../components/EvaluationConfigModal'
import { useToast } from '../components/ToastNotification'

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
  evaluation_id?: string  // Added for export functionality
  function_calls?: Array<{
    function_name: string
    parameters: Record<string, any>
    result?: Record<string, any>
    success: boolean
    execution_time_ms: number
    error?: string
    error_type?: string
    error_details?: {
      error_type: string
      error_message: string
      full_traceback: string
      failed_function_call: Record<string, any>
      attempted_function_name: string
      raw_parameters: Record<string, any>
      timestamp: number
    }
  }>
  function_decision?: {
    thought_process?: string
    total_execution_time_ms?: number
    error?: string
    raw_response?: string
  }
  function_decision_gemini_call?: {
    prompt?: string
    response?: string
    function_call?: string
    model_config?: Record<string, any>
    contents?: Array<any>
    timestamp?: number
    success?: boolean
  }
  cost_usd?: number  // Total API cost in USD for this turn
  token_usage?: number  // Total tokens used for this turn
  cost_breakdown?: {    // Detailed cost breakdown
    cleaning_cost_usd: number
    function_cost_usd: number
    total_cost_usd: number
    cleaning_tokens: {
      input_tokens: number
      output_tokens: number
      total_tokens: number
    }
    function_tokens: {
      input_tokens: number
      output_tokens: number
      total_tokens: number
    }
    total_tokens: number
    model_used: string
  }
  metadata: {
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
  request_data: unknown
  response_data: unknown
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
    model_config: unknown
    prompt: string
    response: string
    timestamp: number
    success: boolean
  }
  // Function calling steps (steps 5-8)
  functionDecisionCall?: {
    function_call: string
    model_config: unknown
    prompt: string
    response: string
    timestamp: number
    success: boolean
    latency_ms: number
  }
  functionExecutions?: Array<{
    function_name: string
    parameters: Record<string, any>
    result?: Record<string, any>
    success: boolean
    execution_time_ms: number
    error?: string
    timestamp: number
  }>
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
  // Toast notifications
  const toast = useToast()
  
  // Theme helper functions
  
  const getSpacing = (base: number) => {
    return Math.round(base * 0.7) // Always more compact than before
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
  const [currentConversation, setCurrentConversation] = useState<{ id: string; name: string } | null>(null)
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null)
  const [currentEvaluationName, setCurrentEvaluationName] = useState<string | null>(null)
  const [currentPromptTemplateName, setCurrentPromptTemplateName] = useState<string | null>(null)
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [copyCompactLoading, setCopyCompactLoading] = useState(false)
  const [showEvaluationInfoModal, setShowEvaluationInfoModal] = useState(false)
  const [modalFunctionTemplateName, setModalFunctionTemplateName] = useState<string | null>(null)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'results' | 'api' | 'logs' | 'cleaner-config' | 'function-config'>('results')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('transcript-cleaner-dark-mode')
    return saved ? JSON.parse(saved) : true // Default to dark mode
  })
  const [detailedLogs, setDetailedLogs] = useState<string[]>([])
  const [hideLumenTurns, setHideLumenTurns] = useState(false)
  const [showOnlyCleaned, setShowOnlyCleaned] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem('transcript-cleaner-panel-width')
    return saved ? parseInt(saved) : 6
  })
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectedTurn, setInspectedTurn] = useState<CleanedTurn | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  
  // Conversations modal state
  const [showConversationsModal, setShowConversationsModal] = useState(false)
  const [conversations, setConversations] = useState<{ id: string; name: string; description?: string; created_at: string; turns_count: number }[]>([])
  const [conversationEvaluations, setConversationEvaluations] = useState<{[key: string]: { id: string; name: string; created_at: string; template_name?: string; prompt_template_name?: string; prompt_template?: string; description?: string }[]}>({})
  const [loadingConversations, setLoadingConversations] = useState(false)

  // Customers modal state
  const [showCustomersModal, setShowCustomersModal] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; user_name: string; job_title: string; company_name: string; company_description: string; company_size: string; company_sector: string; is_default: boolean; created_at: string; updated_at: string }[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingEvaluation, setLoadingEvaluation] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState('')
  const [loadingAbortController, setLoadingAbortController] = useState<AbortController | null>(null)
  const [newConversationName, setNewConversationName] = useState('')
  const [newConversationDescription, setNewConversationDescription] = useState('')
  const [newConversationText, setNewConversationText] = useState('')

  // Evaluations modal state
  const [showEvaluationsModal, setShowEvaluationsModal] = useState(false)
  const [selectedConversationForEvaluations, setSelectedConversationForEvaluations] = useState<{ id: string; name: string } | null>(null)
  
  // Evaluation Config Modal state
  const [showEvaluationConfigModal, setShowEvaluationConfigModal] = useState(false)
  const [evaluationConfigData, setEvaluationConfigData] = useState<any>(null)
  
  // Panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  
  // Prompt template state
  const [promptTemplates, setPromptTemplates] = useState<{ id: string; name: string; template: string; description?: string; variables?: string[] }[]>([])
  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  
  // Function prompt template state
  const [functionPromptTemplates, setFunctionPromptTemplates] = useState<{ id: string; name: string; template: string; description?: string; variables?: string[] }[]>([])
  const [selectedFunctionTemplatePreview, setSelectedFunctionTemplatePreview] = useState('')
  const [loadingFunctionTemplates, setLoadingFunctionTemplates] = useState(false)

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
    localStorage.setItem('transcript-cleaner-dark-mode', JSON.stringify(darkMode))
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
      promptTemplate: null,
      // User Variables
      callContext: '',
      additionalContext: '',
      // Function Caller Configuration
      functionWindowSize: 10,
      functionPromptTemplate: null,
      functionModelName: 'gemini-2.5-flash-lite-preview-06-17',
      functionTemperature: 0.1,
      functionTopP: 0.95,
      functionTopK: 40,
      functionMaxTokens: 65535
    }
  })
  
  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('transcript-cleaner-settings', JSON.stringify(settings))
  }, [settings])

  // Helper function to play completion sound
  const playCompletionSound = () => {
    try {
      // Create a pleasant completion sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Create a sequence of notes for a pleasant completion chime
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5 (major chord)
      
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
        oscillator.type = 'sine'
        
        // Create a pleasant fade-in and fade-out envelope
        const startTime = audioContext.currentTime + (index * 0.15)
        const duration = 0.4
        
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      })
      
      console.log('🔊 Completion sound played')
    } catch (error: any) {
      console.log('🔇 Could not play completion sound:', error.message)
    }
  }

  // Helper function to extract prompt template name from evaluation data
  const extractPromptTemplateName = (evaluationData: Record<string, unknown>): string | null => {
    console.log('[DEBUG] extractPromptTemplateName called with:', evaluationData)
    
    // Check if prompt_template_ref exists (from detailed evaluation response)
    if (evaluationData?.prompt_template_ref && typeof evaluationData.prompt_template_ref === 'object' && evaluationData.prompt_template_ref !== null && 'name' in evaluationData.prompt_template_ref) {
      console.log('[DEBUG] Found prompt_template_ref.name:', evaluationData.prompt_template_ref.name)
      return evaluationData.prompt_template_ref.name as string
    }
    // Check if prompt_template exists as object with name (from export response)
    if (evaluationData?.prompt_template && typeof evaluationData.prompt_template === 'object' && evaluationData.prompt_template !== null && 'name' in evaluationData.prompt_template) {
      console.log('[DEBUG] Found prompt_template.name:', evaluationData.prompt_template.name)
      return evaluationData.prompt_template.name as string
    }
    // Fallback to checking settings
    if (evaluationData?.settings && typeof evaluationData.settings === 'object' && evaluationData.settings !== null && 'prompt_template_name' in evaluationData.settings) {
      console.log('[DEBUG] Found settings.prompt_template_name:', evaluationData.settings.prompt_template_name)
      return evaluationData.settings.prompt_template_name as string
    }
    // Check if this is an inline template
    if (evaluationData?.prompt_template && typeof evaluationData.prompt_template === 'string') {
      console.log('[DEBUG] Found inline template')
      return 'Inline Template'
    }
    
    console.log('[DEBUG] No prompt template name found, checking prompt_template_id:', evaluationData?.prompt_template_id)
    return null
  }

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

  const apiCallWithLogging = async (method: string, endpoint: string, data?: unknown) => {
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
      
      const response = await apiCallWithLogging('GET', '/api/v1/prompt-engineering/templates') as { id: string; name: string; template: string; description?: string; variables?: string[] }[]
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

  // Load function prompt templates from backend
  const loadFunctionPromptTemplates = async () => {
    try {
      setLoadingFunctionTemplates(true)
      addDetailedLog('🔧 Loading function prompt templates...')
      
      const response = await apiCallWithLogging('GET', '/api/v1/prompt-engineering/function-templates') as { id: string; name: string; template: string; description?: string; variables?: string[] }[]
      const templates = Array.isArray(response) ? response : []
      setFunctionPromptTemplates(templates)
      
      addDetailedLog(`✅ Loaded ${templates.length} function prompt templates`)
    } catch (error: any) {
      addDetailedLog(`❌ Failed to load function templates: ${error.message}`)
      // Fallback templates for demo
      setFunctionPromptTemplates([
        {
          id: 'default-function',
          name: 'Default Function Caller Template',
          description: 'The original system prompt for function calling',
          template: 'You are an expert function caller...',
          variables: ['conversation_context', 'available_functions', 'previous_function_calls']
        }
      ])
    } finally {
      setLoadingFunctionTemplates(false)
    }
  }

  // Handle function template selection
  const handleFunctionTemplateChange = (templateId: string) => {
    const template = functionPromptTemplates.find(t => t.id === templateId)
    if (template) {
      setSettings({...settings, functionPromptTemplate: template})
      setSelectedFunctionTemplatePreview(template.template)
      addDetailedLog(`🎯 Selected function template: ${template.name}`)
    } else {
      setSettings({...settings, functionPromptTemplate: null})
      setSelectedFunctionTemplatePreview('')
    }
  }

  // Load templates on component mount
  React.useEffect(() => {
    loadPromptTemplates()
    loadFunctionPromptTemplates()
  }, [])

  // Prepare config data for the evaluation modal
  const prepareEvaluationConfig = () => {
    return {
      evaluation: {
        id: '',
        name: `Evaluation ${new Date().toLocaleString()}`,
        description: `Auto-created evaluation with ${settings.cleaningLevel} cleaning`,
        created_at: new Date().toISOString()
      },
      cleanerConfig: {
        templateName: settings.promptTemplate?.name || 'Default System Prompt',
        templateDescription: settings.promptTemplate?.description,
        slidingWindow: settings.slidingWindow,
        cleaningLevel: settings.cleaningLevel,
        modelName: settings.modelName,
        temperature: settings.temperature,
        topP: settings.topP,
        topK: settings.topK,
        maxTokens: settings.maxTokens
      },
      functionConfig: {
        templateName: settings.functionPromptTemplate?.name || 'Default Function Prompt',
        templateDescription: settings.functionPromptTemplate?.description,
        slidingWindow: settings.functionWindowSize,
        modelName: settings.functionModelName,
        temperature: settings.functionTemperature,
        topP: settings.functionTopP,
        topK: settings.functionTopK,
        maxTokens: settings.functionMaxTokens
      }
    }
  }

  // Show evaluation config modal before starting
  const showEvaluationConfigBeforeStart = () => {
    if (!conversationId) {
      addDetailedLog(`❌ Cannot start cleaning: No conversation selected`)
      return
    }

    const config = prepareEvaluationConfig()
    setEvaluationConfigData(config)
    setShowEvaluationConfigModal(true)
  }

  // The actual cleaning logic (moved from startCleaning)
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
          },
          function_params: {
            model_name: settings.functionModelName,
            temperature: settings.functionTemperature,
            top_p: settings.functionTopP,
            top_k: settings.functionTopK,
            max_tokens: settings.functionMaxTokens,
            window_size: settings.functionWindowSize,
            prompt_template_id: settings.functionPromptTemplate?.id || null
          },
          user_variables: {
            call_context: settings.callContext || "",
            additional_context: settings.additionalContext || ""
          }
        }
      }
      
      const evaluationResponse = await apiCallWithLogging('POST', `/api/v1/evaluations/conversations/${conversationId}/evaluations`, evaluationData) as { id: string }
      const evaluationId = evaluationResponse.id
      setCurrentEvaluationId(evaluationId)
      addDetailedLog(`✅ Created evaluation: ${evaluationName} (${evaluationId})`)
      
      // Step 2: Get raw turns from the conversation
      addDetailedLog('🔍 Fetching raw turns from conversation...')
      const turnsResponse = await apiCallWithLogging('GET', `/api/v1/conversations/${conversationId}/turns`) as { turns: { id: string; speaker: string; raw_text: string; turn_sequence: number }[] }
      const rawTurns = turnsResponse.turns || []
      addDetailedLog(`📊 Found ${rawTurns.length} raw turns to process`)
      
      // Set the raw turns for display in the conversation component
      const parsedRawTurns: ParsedTurn[] = rawTurns.map((turn, index: number) => ({
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
        }) as { 
          turn_id: string; 
          raw_speaker: string; 
          raw_text: string; 
          cleaned_text: string; 
          turn_sequence: number; 
 
          cleaning_applied: boolean; 
          cleaning_level: string; 
          timing_breakdown: unknown; 
          corrections: unknown[]; 
          context_detected: string; 
          processing_time_ms: number; 
          ai_model_used: string; 
          gemini_prompt: string; 
          gemini_response: string; 
          created_at: string; 
          gemini_function_call?: { 
            function_call: string; 
            model_config: unknown; 
            prompt: string; 
            response: string; 
            timestamp: number; 
            success: boolean 
          };
          function_calls?: Array<{
            function_name: string;
            parameters: Record<string, any>;
            result?: Record<string, any>;
            success: boolean;
            execution_time_ms: number;
            error?: string;
          }>;
          function_decision?: {
            thought_process?: string;
            total_execution_time_ms?: number;
          };
          function_decision_gemini_call?: {
            prompt?: string;
            response?: string;
            function_call?: string;
            model_config?: Record<string, any>;
            contents?: Array<any>;
            timestamp?: number;
            success?: boolean;
            latency_ms?: number;
          };
        }
        
        // Convert to UI format
        const cleanedTurn: CleanedTurn = {
          turn_id: turnResult.turn_id,
          conversation_id: conversationId,
          speaker: turnResult.raw_speaker,
          raw_text: turnResult.raw_text,
          cleaned_text: turnResult.cleaned_text,
          turn_sequence: turnResult.turn_sequence,
          processing_state: 'completed',
          function_calls: turnResult.function_calls || [],
          function_decision: turnResult.function_decision,
          function_decision_gemini_call: turnResult.function_decision_gemini_call,
          cost_usd: (turnResult as any).cost_usd, // Add cost tracking data
          token_usage: (turnResult as any).token_usage, // Add token usage data
          cost_breakdown: (turnResult as any).cost_breakdown, // Add detailed cost breakdown
          metadata: {
            cleaning_applied: turnResult.cleaning_applied,
            cleaning_level: turnResult.cleaning_level,
            timing_breakdown: turnResult.timing_breakdown as CleanedTurn['metadata']['timing_breakdown'],
            corrections: (turnResult.corrections || []) as CleanedTurn['metadata']['corrections'],
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
          } : undefined,
          // Add function calling data (steps 5-8)
          functionDecisionCall: turnResult.function_decision_gemini_call ? {
            function_call: 'generateContent (function decision)',
            model_config: turnResult.function_decision_gemini_call.model_config,
            prompt: turnResult.function_decision_gemini_call.prompt || '',
            response: turnResult.function_decision_gemini_call.response || '',
            timestamp: turnResult.function_decision_gemini_call.timestamp || Date.now(),
            success: turnResult.function_decision_gemini_call.success || false,
            latency_ms: turnResult.function_decision_gemini_call.latency_ms || 0
          } : undefined,
          functionExecutions: turnResult.function_calls ? turnResult.function_calls.map((funcCall: any) => ({
            function_name: funcCall.function_name,
            parameters: funcCall.parameters,
            result: funcCall.result,
            success: funcCall.success,
            execution_time_ms: funcCall.execution_time_ms,
            error: funcCall.error,
            timestamp: Date.now() // Will be updated when we get actual timestamps from backend
          })) : undefined
        }
        
        setTurnAPIGroups(prev => [...prev, turnAPIGroup])
        processedTurns.push(cleanedTurn)
        
        // Update UI immediately with current progress
        setCleanedTurns([...processedTurns])
        
        addDetailedLog(`✅ Turn ${i + 1} completed: ${rawTurn.speaker}`)
      }
      
      // Final update - all turns are already in cleanedTurns from real-time processing
      addDetailedLog(`🎉 Real-time processing completed! ${processedTurns.length} turns processed and displayed`)
      
      // Show success toast
      toast.showSuccess('Evaluation Complete!', `Successfully processed ${processedTurns.length} turns. All data saved to evaluation database.`)
      
      // All processing is handled by the evaluation system automatically!
      
    
    } catch (error: any) {
      addDetailedLog(`❌ Cleaning process failed: ${error.message || error}`)
      console.error('Cleaning error:', error)
      alert(`Cleaning failed: ${error.message || error}`)
      
      // Show error toast
      toast.showError('Evaluation Failed', `Processing failed: ${error.message || error}`)
      
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
      // Keep currentEvaluationId for export functionality even if cleaning failed
      addDetailedLog('🏁 Cleaning process completed')
      
      // Play completion sound
      playCompletionSound()
    }
  }

  const stopCleaning = async () => {
    if (!currentEvaluationId) {
      addDetailedLog(`❌ Cannot stop cleaning: No active evaluation`)
      return
    }

    addDetailedLog(`⏹️ Stopping evaluation: ${currentEvaluationId}`)
    
    try {
      await apiCallWithLogging('POST', `/api/v1/evaluations/${currentEvaluationId}/stop`, {}) as Record<string, unknown>
      addDetailedLog(`✅ Evaluation stopped successfully`)
      
      // Show stop success toast
      toast.showInfo('Evaluation Stopped', 'Processing has been stopped. Partial results are available for review.')
      
      // Keep the processing state but update the UI
      setIsProcessing(false)
      // Keep currentEvaluationId for export functionality even after stopping
      
    } catch (error: any) {
      addDetailedLog(`❌ Failed to stop evaluation: ${error.message || error}`)
      console.error('Stop error:', error)
      toast.showError('Stop Failed', `Unable to stop evaluation: ${error.message || error}`)
    }
  }


  // Conversations management functions
  const loadConversations = async () => {
    try {
      setLoadingConversations(true)
      const response = await apiClient.get('/api/v1/conversations') as { conversations: { id: string; name: string; description?: string; created_at?: string; turns_count?: number }[] }
      const conversationList = (response.conversations || []).map(conv => ({
        ...conv,
        created_at: conv.created_at || new Date().toISOString(),
        turns_count: conv.turns_count || 0
      }))
      setConversations(conversationList)
      
      // Load evaluations for each conversation
      const evaluationData: {[key: string]: { id: string; name: string; created_at: string; template_name?: string; prompt_template_name?: string; prompt_template?: string; description?: string }[]} = {}
      for (const conversation of conversationList) {
        try {
          const evaluationsResponse = await apiClient.getEvaluations(conversation.id) as { evaluations: { id: string; name: string; created_at?: string; template_name?: string; prompt_template_name?: string; prompt_template?: string; description?: string }[] }
          evaluationData[conversation.id] = (evaluationsResponse.evaluations || []).map(evaluation => ({
            ...evaluation,
            created_at: evaluation.created_at || new Date().toISOString()
          }))
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
      
      const conversationId = (convResponse as { id: string }).id
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

  const openEvaluationsModal = (conversation: { id: string; name: string }) => {
    setSelectedConversationForEvaluations(conversation)
    setShowEvaluationsModal(true)
  }

  // Function to show evaluation config modal
  const showEvaluationConfig = async (evaluation: { id: string; name: string }) => {
    try {
      // Fetch evaluation details
      const evaluationDetails = await apiClient.getEvaluationDetails(evaluation.id) as any
      console.log('Evaluation details for config:', evaluationDetails)
      
      // Extract settings
      const evaluation_data = evaluationDetails.evaluation
      const settings = evaluation_data.settings || {}
      const modelParams = settings.model_params || {}
      const functionParams = settings.function_params || {}
      
      // Build config object
      const config = {
        evaluation: {
          id: evaluation.id,
          name: evaluation.name,
          description: evaluation_data.description || 'No description',
          created_at: evaluation_data.created_at || new Date().toISOString()
        },
        cleanerConfig: {
          templateName: evaluation_data.prompt_template?.name || evaluation_data.prompt_template_name || 'Default Template',
          templateDescription: evaluation_data.prompt_template?.description || 'No description',
          slidingWindow: settings.sliding_window || 10,
          cleaningLevel: settings.cleaning_level || 'full',
          modelName: modelParams.model_name || 'gemini-2.5-flash-lite-preview-06-17',
          temperature: modelParams.temperature || 0.1,
          topP: modelParams.top_p || 0.95,
          topK: modelParams.top_k || 40,
          maxTokens: modelParams.max_tokens || 65535
        },
        functionConfig: {
          templateName: evaluation_data.function_template?.name || 'Default Function Template',
          templateDescription: evaluation_data.function_template?.description || 'No description',
          slidingWindow: functionParams.window_size || 20,
          modelName: functionParams.model_name || 'gemini-2.5-flash-lite-preview-06-17',
          temperature: functionParams.temperature || 0.1,
          topP: functionParams.top_p || 0.95,
          topK: functionParams.top_k || 40,
          maxTokens: functionParams.max_tokens || 65535
        }
      }
      
      setEvaluationConfigData(config)
      setShowEvaluationConfigModal(true)
      
    } catch (error) {
      console.error('Failed to fetch evaluation config:', error)
      alert('Failed to load evaluation configuration')
    }
  }

  // Customer management functions
  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true)
      const response = await apiClient.getCustomers() as { customers: { id: string; user_name: string; job_title: string; company_name: string; company_description: string; company_size: string; company_sector: string; is_default?: boolean; created_at?: string; updated_at?: string }[] }
      setCustomers((response.customers || []).map(customer => ({
        ...customer,
        is_default: customer.is_default || false,
        created_at: customer.created_at || new Date().toISOString(),
        updated_at: customer.updated_at || new Date().toISOString()
      })))
    } catch (error) {
      console.error('Failed to load customers:', error)
      toast.showError('Failed to Load Customers', 'Unable to fetch customer list. Please try again.')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const openCustomersModal = () => {
    setShowCustomersModal(true)
    loadCustomers() // Load customers when modal opens
  }

  const handleAddCustomer = async (customerData: { user_name: string; job_title: string; company_name: string; company_description: string; company_size: string; company_sector: string; is_default?: boolean }) => {
    try {
      setLoadingCustomers(true)
      await apiClient.createCustomer(customerData)
      await loadCustomers() // Reload the list
      toast.showSuccess('Customer Added', `${customerData.user_name} has been added successfully.`)
    } catch (error) {
      console.error('Failed to add customer:', error)
      toast.showError('Failed to Add Customer', 'Unable to create new customer. Please check your input and try again.')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleEditCustomer = async (customer: { id: string; user_name: string; job_title: string; company_name: string; company_description: string; company_size: string; company_sector: string; is_default?: boolean; created_at: string; updated_at: string }) => {
    try {
      setLoadingCustomers(true)
      const { id, created_at, updated_at, ...updateData } = customer
      await apiClient.updateCustomer(id, updateData)
      await loadCustomers() // Reload the list
      toast.showSuccess('Customer Updated', `${customer.user_name} has been updated successfully.`)
    } catch (error) {
      console.error('Failed to update customer:', error)
      toast.showError('Failed to Update Customer', 'Unable to save changes. Please try again.')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      setLoadingCustomers(true)
      await apiClient.deleteCustomer(customerId)
      await loadCustomers() // Reload the list
      toast.showSuccess('Customer Deleted', 'Customer has been removed successfully.')
    } catch (error) {
      console.error('Failed to delete customer:', error)
      const errorMessage = error instanceof Error && error.message.includes('currently used') 
        ? 'Cannot delete customer: currently being used in evaluations.'
        : 'Unable to delete customer. Please try again.'
      toast.showError('Failed to Delete Customer', errorMessage)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleSetDefaultCustomer = async (customerId: string) => {
    try {
      setLoadingCustomers(true)
      const response = await apiClient.setDefaultCustomer(customerId) as { user_name: string }
      await loadCustomers() // Reload the list
      toast.showSuccess('Default Customer Set', `${response.user_name} is now the default customer.`)
    } catch (error) {
      console.error('Failed to set default customer:', error)
      toast.showError('Failed to Set Default', 'Unable to set default customer. Please try again.')
    } finally {
      setLoadingCustomers(false)
    }
  }

  // NOTE: Save functions removed - evaluations auto-save during processing

  const cancelEvaluationLoad = () => {
    if (loadingAbortController) {
      loadingAbortController.abort()
      setLoadingAbortController(null)
      setLoadingEvaluation(false)
      setLoadingProgress('')
      addDetailedLog('🚫 Evaluation loading cancelled by user')
    }
  }

  const loadLatestEvaluation = async (conversation: { id: string; name: string }) => {
    // Cancel any existing load operation
    if (loadingAbortController) {
      loadingAbortController.abort()
    }
    
    const controller = new AbortController()
    setLoadingAbortController(controller)
    setLoadingEvaluation(true)
    setLoadingProgress('Initializing...')
    
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
      setLoadingProgress('Fetching evaluation metadata...')
      addDetailedLog(`📡 Requesting evaluation details for ID: ${latestEvaluation.id}`)
      const evaluationDetails = await apiClient.getEvaluationDetails(latestEvaluation.id, controller.signal) as { evaluation: Record<string, unknown>; cleaned_turns: { turn_id: string; raw_speaker: string; raw_text: string; cleaned_text: string; turn_sequence: number; cleaning_applied: boolean; cleaning_level: string; timing_breakdown: unknown; corrections: unknown[]; context_detected: string; processing_time_ms: number; ai_model_used: string; gemini_prompt: string; gemini_response: string; created_at: string }[] }
      
      const turnCount = evaluationDetails.cleaned_turns?.length || 0
      setLoadingProgress(`Processing ${turnCount} cleaned turns...`)
      addDetailedLog(`✅ Received evaluation details, processing ${turnCount} cleaned turns`)
      
      // Set conversation context
      setConversationId(conversation.id)
      setCurrentConversation(conversation)
      setCurrentEvaluationId(latestEvaluation.id)
      setCurrentEvaluationName(latestEvaluation.name)
      setCurrentPromptTemplateName(extractPromptTemplateName(evaluationDetails.evaluation))
      setShowConversationsModal(false)
      
      // Load raw turns for the conversation component
      setLoadingProgress('Loading conversation turns...')
      addDetailedLog(`📡 Requesting raw turns for conversation: ${conversation.id}`)
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`, controller.signal) as { turns: { speaker: string; raw_text: string; turn_sequence: number }[] }
      addDetailedLog(`✅ Received ${turnsResponse.turns?.length || 0} raw turns`)
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        const turns = turnsResponse.turns.map((turn) => ({
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
      
      // Convert evaluation cleaned turns to UI format with complete data
      setLoadingProgress(`Converting ${turnCount} turns to UI format...`)
      const cleaned: CleanedTurn[] = evaluationDetails.cleaned_turns.map((cleanedTurn) => ({
        turn_id: cleanedTurn.turn_id,
        conversation_id: conversation.id,
        speaker: cleanedTurn.raw_speaker,
        raw_text: cleanedTurn.raw_text,
        cleaned_text: cleanedTurn.cleaned_text,
        turn_sequence: cleanedTurn.turn_sequence,  // Use actual sequence from backend
        processing_state: 'completed',
        evaluation_id: latestEvaluation.id,  // Add evaluation ID for export
        metadata: {
          cleaning_applied: cleanedTurn.cleaning_applied,
          cleaning_level: cleanedTurn.cleaning_level,
          timing_breakdown: cleanedTurn.timing_breakdown as CleanedTurn['metadata']['timing_breakdown'],
          corrections: (cleanedTurn.corrections || []) as CleanedTurn['metadata']['corrections'],
          context_detected: cleanedTurn.context_detected,
          processing_time_ms: cleanedTurn.processing_time_ms,
          ai_model_used: cleanedTurn.ai_model_used,
          gemini_prompt: cleanedTurn.gemini_prompt,
          gemini_response: cleanedTurn.gemini_response
        },
        // IMPORTANT: Include function call data from evaluation loading
        function_calls: (cleanedTurn as any).function_calls || [],
        function_decision: (cleanedTurn as any).function_decision || null,
        function_decision_gemini_call: (cleanedTurn as any).function_decision_gemini_call || null,
        // Add cost tracking data from evaluation loading
        cost_usd: (cleanedTurn as any).cost_usd,
        token_usage: (cleanedTurn as any).token_usage,
        cost_breakdown: (cleanedTurn as any).cost_breakdown,
        created_at: cleanedTurn.created_at
      }))
      
      // Reconstruct API logs from evaluation data
      const reconstructedTurnAPIGroups: TurnAPIGroup[] = evaluationDetails.cleaned_turns.map((cleanedTurn, index: number) => {
        const turnIndex = index
        const turnSequence = cleanedTurn.turn_sequence
        const speaker = cleanedTurn.raw_speaker
        const rawText = cleanedTurn.raw_text
        
        // Create mock API call objects based on the evaluation data
        const frontendRequest: APICall = {
          id: `${cleanedTurn.turn_id}-frontend`,
          timestamp: cleanedTurn.created_at,
          method: 'POST',
          endpoint: `/api/v1/evaluations/${latestEvaluation.id}/process-turn`,
          request_data: { turn_id: cleanedTurn.turn_id },
          response_data: cleanedTurn,
          status: 200,
          latency_ms: cleanedTurn.processing_time_ms || 0
        }
        
        const backendResponse: APICall = {
          ...frontendRequest,
          response_data: cleanedTurn
        }
        
        return {
          turnIndex,
          turnSequence,
          speaker,
          rawText,
          frontendRequest,
          backendResponse,
          geminiFunctionCall: cleanedTurn.gemini_prompt ? {
            function_call: 'generateContent',
            model_config: { model_name: cleanedTurn.ai_model_used || 'gemini-2.5-flash-lite-preview-06-17' },
            prompt: cleanedTurn.gemini_prompt,
            response: cleanedTurn.gemini_response,
            timestamp: Date.now(),
            success: true
          } : undefined,
          // Add function calling data from loaded evaluation
          functionDecisionCall: (cleanedTurn as any).function_decision_gemini_call ? {
            function_call: 'generateContent (function decision)',
            model_config: (cleanedTurn as any).function_decision_gemini_call.model_config,
            prompt: (cleanedTurn as any).function_decision_gemini_call.prompt,
            response: (cleanedTurn as any).function_decision_gemini_call.response,
            timestamp: (cleanedTurn as any).function_decision_gemini_call.timestamp,
            success: (cleanedTurn as any).function_decision_gemini_call.success,
            latency_ms: (cleanedTurn as any).function_decision_gemini_call.latency_ms || 0
          } : undefined,
          functionExecutions: (cleanedTurn as any).function_calls ? (cleanedTurn as any).function_calls.map((funcCall: any) => ({
            function_name: funcCall.function_name,
            parameters: funcCall.parameters,
            result: funcCall.result,
            success: funcCall.success,
            execution_time_ms: funcCall.execution_time_ms,
            error: funcCall.error,
            timestamp: Date.now()
          })) : undefined
        }
      })
      
      setLoadingProgress('Finalizing UI...')
      
      // Count function calls for logging
      const totalFunctionCalls = cleaned.reduce((total, turn) => total + (turn.function_calls?.length || 0), 0)
      const turnsWithFunctions = cleaned.filter(turn => turn.function_calls && turn.function_calls.length > 0)
      
      setCleanedTurns(cleaned)
      setTurnAPIGroups(reconstructedTurnAPIGroups)
      setSelectedTab('results')
      addDetailedLog(`✅ Loaded ${cleaned.length} cleaned turns from evaluation: ${latestEvaluation.name}`)
      addDetailedLog(`📊 Function calls: ${totalFunctionCalls} calls across ${turnsWithFunctions.length} turns`)
      addDetailedLog(`✅ Reconstructed ${reconstructedTurnAPIGroups.length} API log entries for inspection`)
      
    } catch (error: any) {
      console.error('Failed to load latest evaluation:', error)
      
      if (error.name === 'AbortError') {
        addDetailedLog('🚫 Evaluation loading was cancelled')
        // Don't show alert for user-cancelled operations
      } else {
        addDetailedLog(`❌ Failed to load evaluation: ${error.message}`)
        alert(`Failed to load latest evaluation: ${error.message}`)
      }
    } finally {
      setLoadingEvaluation(false)
      setLoadingProgress('')
      setLoadingAbortController(null)
    }
  }
  
  const loadSpecificEvaluation = async (evaluation: { id: string; name: string }, conversation: { id: string; name: string }) => {
    try {
      addDetailedLog(`📊 Loading specific evaluation: ${evaluation.name}`);
      
      // Load evaluation details including cleaned turns
      const evaluationDetails = await apiClient.getEvaluationDetails(evaluation.id) as { evaluation: Record<string, unknown>; cleaned_turns: { turn_id: string; raw_speaker: string; raw_text: string; cleaned_text: string; turn_sequence: number; cleaning_applied: boolean; cleaning_level: string; timing_breakdown: unknown; corrections: unknown[]; context_detected: string; processing_time_ms: number; ai_model_used: string; gemini_prompt: string; gemini_response: string; created_at: string }[] }
      
      // Set conversation context
      setConversationId(conversation.id)
      setCurrentConversation(conversation)
      setCurrentEvaluationId(evaluation.id)
      setCurrentEvaluationName(evaluation.name)
      
      // Debug: Log the full evaluation details to understand the structure
      console.log('[DEBUG] Full evaluationDetails:', evaluationDetails)
      console.log('[DEBUG] evaluationDetails.evaluation:', evaluationDetails.evaluation)
      console.log('[DEBUG] Original evaluation object:', evaluation)
      
      const extractedTemplateName = extractPromptTemplateName(evaluationDetails.evaluation)
      console.log('[DEBUG] Extracted template name:', extractedTemplateName)
      
      // Enhanced fallback logic to handle different data sources
      let finalTemplateName = extractedTemplateName
      
      if (!finalTemplateName) {
        // Try to get from original evaluation object's template field
        if ((evaluation as any).template_name) {
          finalTemplateName = (evaluation as any).template_name
          console.log('[DEBUG] Using evaluation.template_name:', finalTemplateName)
        } else if ((evaluation as any).prompt_template_name) {
          finalTemplateName = (evaluation as any).prompt_template_name
          console.log('[DEBUG] Using evaluation.prompt_template_name:', finalTemplateName)
        } else if (typeof (evaluation as any).prompt_template === 'string' && (evaluation as any).prompt_template.includes('gemini')) {
          // Extract from prompt template content
          const match = (evaluation as any).prompt_template.match(/gemini\s*(v?\d+)/i)
          if (match) {
            finalTemplateName = `gemini ${match[1]}`
            console.log('[DEBUG] Extracted from prompt template content:', finalTemplateName)
          }
        } else {
          // Last resort: check if evaluation name contains template info
          if ((evaluation as any).description && (evaluation as any).description.includes('gemini')) {
            const match = (evaluation as any).description.match(/gemini\s*(v?\d+)/i)
            if (match) {
              finalTemplateName = `gemini ${match[1]}`
              console.log('[DEBUG] Extracted from evaluation description:', finalTemplateName)
            }
          }
        }
      }
      
      setCurrentPromptTemplateName(finalTemplateName)
      setShowEvaluationsModal(false)
      
      // Load raw turns for the conversation component
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`) as { turns: { speaker: string; raw_text: string; turn_sequence: number }[] }
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        const turns = turnsResponse.turns.map((turn) => ({
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
      const cleaned: CleanedTurn[] = evaluationDetails.cleaned_turns.map((cleanedTurn) => ({
        turn_id: cleanedTurn.turn_id,
        conversation_id: conversation.id,
        speaker: cleanedTurn.raw_speaker,
        raw_text: cleanedTurn.raw_text,
        cleaned_text: cleanedTurn.cleaned_text,
        turn_sequence: cleanedTurn.turn_sequence,  // Use actual sequence from backend
        processing_state: 'completed',
        evaluation_id: evaluation.id,  // Add evaluation ID for export
        metadata: {
          cleaning_applied: cleanedTurn.cleaning_applied,
          cleaning_level: cleanedTurn.cleaning_level,
          corrections: (cleanedTurn.corrections || []) as CleanedTurn['metadata']['corrections'],
          context_detected: cleanedTurn.context_detected,
          processing_time_ms: cleanedTurn.processing_time_ms,
          ai_model_used: cleanedTurn.ai_model_used,
          timing_breakdown: cleanedTurn.timing_breakdown as CleanedTurn['metadata']['timing_breakdown'],
          gemini_prompt: cleanedTurn.gemini_prompt,
          gemini_response: cleanedTurn.gemini_response
        },
        // IMPORTANT: Include function call data from evaluation loading
        function_calls: (cleanedTurn as any).function_calls || [],
        function_decision: (cleanedTurn as any).function_decision || null,
        function_decision_gemini_call: (cleanedTurn as any).function_decision_gemini_call || null,
        // Add cost tracking data from evaluation loading
        cost_usd: (cleanedTurn as any).cost_usd,
        token_usage: (cleanedTurn as any).token_usage,
        cost_breakdown: (cleanedTurn as any).cost_breakdown,
        created_at: cleanedTurn.created_at
      }))
      
      // Reconstruct API logs from evaluation data
      const reconstructedTurnAPIGroups: TurnAPIGroup[] = evaluationDetails.cleaned_turns.map((cleanedTurn, index: number) => {
        const turnIndex = index
        const turnSequence = cleanedTurn.turn_sequence
        const speaker = cleanedTurn.raw_speaker
        const rawText = cleanedTurn.raw_text
        
        // Create mock API call objects based on the evaluation data
        const frontendRequest: APICall = {
          id: `${cleanedTurn.turn_id}-frontend`,
          timestamp: cleanedTurn.created_at,
          method: 'POST',
          endpoint: `/api/v1/evaluations/${evaluation.id}/process-turn`,
          request_data: { turn_id: cleanedTurn.turn_id },
          response_data: cleanedTurn,
          status: 200,
          latency_ms: cleanedTurn.processing_time_ms || 0
        }
        
        const backendResponse: APICall = {
          ...frontendRequest,
          response_data: cleanedTurn
        }
        
        return {
          turnIndex,
          turnSequence,
          speaker,
          rawText,
          frontendRequest,
          backendResponse,
          geminiFunctionCall: cleanedTurn.gemini_prompt ? {
            function_call: 'generateContent',
            model_config: { model_name: cleanedTurn.ai_model_used || 'gemini-2.5-flash-lite-preview-06-17' },
            prompt: cleanedTurn.gemini_prompt,
            response: cleanedTurn.gemini_response,
            timestamp: Date.now(),
            success: true
          } : undefined,
          // Add function calling data from loaded evaluation
          functionDecisionCall: (cleanedTurn as any).function_decision_gemini_call ? {
            function_call: 'generateContent (function decision)',
            model_config: (cleanedTurn as any).function_decision_gemini_call.model_config,
            prompt: (cleanedTurn as any).function_decision_gemini_call.prompt,
            response: (cleanedTurn as any).function_decision_gemini_call.response,
            timestamp: (cleanedTurn as any).function_decision_gemini_call.timestamp,
            success: (cleanedTurn as any).function_decision_gemini_call.success,
            latency_ms: (cleanedTurn as any).function_decision_gemini_call.latency_ms || 0
          } : undefined,
          functionExecutions: (cleanedTurn as any).function_calls ? (cleanedTurn as any).function_calls.map((funcCall: any) => ({
            function_name: funcCall.function_name,
            parameters: funcCall.parameters,
            result: funcCall.result,
            success: funcCall.success,
            execution_time_ms: funcCall.execution_time_ms,
            error: funcCall.error,
            timestamp: Date.now()
          })) : undefined
        }
      })
      
      // Count function calls for logging
      const totalFunctionCalls = cleaned.reduce((total, turn) => total + (turn.function_calls?.length || 0), 0)
      const turnsWithFunctions = cleaned.filter(turn => turn.function_calls && turn.function_calls.length > 0)
      
      setCleanedTurns(cleaned)
      setTurnAPIGroups(reconstructedTurnAPIGroups)
      setSelectedTab('results')
      addDetailedLog(`✅ Loaded ${cleaned.length} cleaned turns from evaluation: ${evaluation.name}`)
      addDetailedLog(`📊 Function calls: ${totalFunctionCalls} calls across ${turnsWithFunctions.length} turns`)
      addDetailedLog(`✅ Reconstructed ${reconstructedTurnAPIGroups.length} API log entries for inspection`)
      
    } catch (error) {
      console.error('Failed to load specific evaluation:', error)
      alert('Failed to load evaluation')
    }
  }
  
  const startNewEvaluation = async (conversation: { id: string; name: string }) => {
    try {
      // Set conversation context and load raw turns
      setConversationId(conversation.id)
      setCurrentEvaluationId(null) // Clear current evaluation when starting new
      setCurrentEvaluationName(null)
      setCurrentPromptTemplateName(null)
      setShowConversationsModal(false)
      
      // Load raw turns
      const turnsResponse = await apiClient.get(`/api/v1/conversations/${conversation.id}/turns`) as { turns: { speaker: string; raw_text: string; turn_sequence: number }[] }
      
      if (turnsResponse.turns && turnsResponse.turns.length > 0) {
        const turns = turnsResponse.turns.map((turn) => ({
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
    !(call.response_data && typeof call.response_data === 'object' && 'metadata' in call.response_data && 
      call.response_data.metadata && typeof call.response_data.metadata === 'object' && 
      'ai_model_used' in call.response_data.metadata && 
      typeof call.response_data.metadata.ai_model_used === 'string' && 
      call.response_data.metadata.ai_model_used.includes('bypass'))
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
              
              {/* Prompt Template Display */}
              {currentPromptTemplateName && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '14px',
                  padding: '4px 8px',
                  backgroundColor: theme.bgTertiary,
                  borderRadius: '4px',
                  border: `1px solid ${theme.border}`
                }}>
                  <span style={{ color: theme.textSecondary }}>Template:</span>
                  <span style={{ color: theme.text, fontWeight: '500' }}>{currentPromptTemplateName}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={openCustomersModal}
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
                👤 Customers
              </button>
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
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left Panel - Input */}
        <div style={{ 
          width: leftPanelCollapsed ? '60px' : `${leftPanelWidth}%`, 
          backgroundColor: theme.bg, 
          borderRight: `1px solid ${theme.border}`, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: leftPanelCollapsed ? '60px' : '15%',
          maxWidth: leftPanelCollapsed ? '60px' : '50%',
          transition: 'width 0.3s ease'
        }}>
          <div style={{ padding: leftPanelCollapsed ? '12px' : '24px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {!leftPanelCollapsed && (
                <h2 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, margin: 0 }}>
                  {currentConversation ? currentConversation.name : 'Conversation'}
                </h2>
              )}
              <button
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.15s ease',
                  backgroundColor: theme.bgSecondary
                }}
                title={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.bgTertiary
                  e.currentTarget.style.borderColor = theme.textMuted
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.bgSecondary
                  e.currentTarget.style.borderColor = theme.border
                }}
              >
                {leftPanelCollapsed ? '→' : '←'}
              </button>
            </div>
            {!leftPanelCollapsed && (
              <>
                <p style={{ fontSize: '14px', color: theme.textMuted, marginTop: '4px', margin: 0 }}>
                  {conversationId && parsedTurns.length > 0 
                    ? `${parsedTurns.length} turns loaded • Ready for cleaning`
                    : 'Load conversations through the Conversations modal'
                  }
                </p>
                {/* Evaluation Context */}
                {currentEvaluationName && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: theme.textSecondary, 
                    marginTop: '8px',
                    padding: '4px 8px',
                    backgroundColor: theme.bgTertiary,
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`
                  }}>
                    <strong>Evaluation:</strong> {currentEvaluationName}
                    {currentPromptTemplateName && (
                      <span style={{ marginLeft: '12px' }}>
                        <strong>Template:</strong> {currentPromptTemplateName}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div style={{ 
            flex: 1, 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {leftPanelCollapsed ? (
              // Show minimal status indicators when collapsed
              <div style={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '16px 8px'
              }}>
                {conversationId && parsedTurns.length > 0 ? (
                  <>
                    <div style={{ 
                      fontSize: '24px',
                      color: theme.accent
                    }}>
                      💬
                    </div>
                    <div style={{ 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.text,
                      textAlign: 'center',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed'
                    }}>
                      {parsedTurns.length}
                    </div>
                    <div style={{ 
                      fontSize: '10px',
                      color: theme.textMuted,
                      textAlign: 'center',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      lineHeight: '1.2'
                    }}>
                      turns
                    </div>
                    {isProcessing && (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: `2px solid ${theme.accent}`,
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    )}
                  </>
                ) : (
                  <div style={{ 
                    fontSize: '20px',
                    color: theme.textMuted
                  }}>
                    📝
                  </div>
                )}
              </div>
            ) : (
              // Show full conversation when expanded
              <>
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
              </>
            )}
          </div>
          
          {!leftPanelCollapsed && (
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
                onClick={isProcessing ? stopCleaning : showEvaluationConfigBeforeStart}
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
          )}
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
                { key: 'cleaner-config', label: 'Cleaner Config', count: null },
                { key: 'function-config', label: 'Function Config', count: null }
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
                    
                    {/* Filter Controls */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      padding: '12px', 
                      backgroundColor: theme.bgSecondary, 
                      borderRadius: '8px', 
                      border: `1px solid ${theme.border}`,
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      {/* Evaluation ID */}
                      {currentEvaluationId && (
                        <div style={{
                          fontSize: '12px',
                          color: theme.textMuted,
                          fontFamily: 'monospace',
                          backgroundColor: theme.bgTertiary,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${theme.border}`
                        }}>
                          ID: {currentEvaluationId.slice(0, 8)}...
                        </div>
                      )}
                      
                      {/* Evaluation Info Button */}
                      {currentEvaluationName && (
                        <div style={{ marginBottom: '8px' }}>
                          <button
                            onClick={async () => {
                              setShowEvaluationInfoModal(true)
                              setModalFunctionTemplateName(null) // Reset
                              
                              // Fetch function template name from export data
                              if (currentEvaluationId) {
                                try {
                                  const exportData = await apiClient.exportEvaluation(currentEvaluationId)
                                  const functionTemplateName = exportData.evaluation.function_template?.name || 'No function template'
                                  setModalFunctionTemplateName(functionTemplateName)
                                } catch (error) {
                                  console.error('Failed to fetch function template name:', error)
                                  setModalFunctionTemplateName('Failed to load')
                                }
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '4px',
                              color: theme.textSecondary,
                              fontSize: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.bgTertiary
                              e.currentTarget.style.color = theme.text
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.color = theme.textSecondary
                            }}
                            title="View evaluation details"
                          >
                            ℹ️
                          </button>
                        </div>
                      )}
                      
                      {/* Controls */}
                      <div style={{ display: 'flex', gap: '12px' }}>
                                            {cleanedTurns.length > 0 && !isProcessing && (
                        <button
                          onClick={async () => {
                            // Find the current evaluation ID from the loaded data
                            const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
                            if (!evaluationId) {
                              alert('No evaluation data available to export')
                              return
                            }
                            
                            try {
                              const exportData = await apiClient.exportEvaluation(evaluationId)
                              
                              // Create and download the file
                              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${exportData.conversation.name.replace(/[^a-zA-Z0-9]/g, '_')}_${exportData.evaluation.id}.json`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                              
                              addDetailedLog(`📥 Exported evaluation: ${exportData.evaluation.name}`)
                            } catch (error) {
                              console.error('Failed to export evaluation:', error)
                              alert('Failed to export evaluation')
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          📥 Export
                        </button>
                      )}
                      
                      {/* Copy JSON Button */}
                      {cleanedTurns.length > 0 && !isProcessing && (
                        <button
                          onClick={async () => {
                            // Find the current evaluation ID from the loaded data
                            const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
                            if (!evaluationId) {
                              alert('No evaluation data available to copy')
                              return
                            }
                            
                            try {
                              // Use ClipboardItem with Promise to maintain user gesture context
                              if (navigator.clipboard && window.ClipboardItem) {
                                const textPromise = apiClient.exportEvaluation(evaluationId)
                                  .then(exportData => {
                                    const jsonString = JSON.stringify(exportData, null, 2)
                                    addDetailedLog(`📋 Copied evaluation JSON to clipboard: ${exportData.evaluation.name}`)
                                    return new Blob([jsonString], { type: 'text/plain' })
                                  })
                                
                                const clipboardItem = new ClipboardItem({
                                  'text/plain': textPromise
                                })
                                
                                await navigator.clipboard.write([clipboardItem])
                                alert('Evaluation JSON copied to clipboard!')
                              } else {
                                // Fallback: Use the same simple approach as Copy Logs
                                const exportData = await apiClient.exportEvaluation(evaluationId)
                                const jsonString = JSON.stringify(exportData, null, 2)
                                await navigator.clipboard.writeText(jsonString)
                                alert('Evaluation JSON copied to clipboard!')
                                addDetailedLog(`📋 Copied evaluation JSON to clipboard: ${exportData.evaluation.name}`)
                              }
                            } catch (error) {
                              console.error('Failed to copy evaluation:', error)
                              alert('Failed to copy evaluation. Please try the Export button instead.')
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#10b981',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          📋 Copy
                        </button>
                      )}
                      
                      {/* Copy Compact Button with Dropdown */}
                      {cleanedTurns.length > 0 && !isProcessing && (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: copyCompactLoading ? 0.7 : 1,
                              marginLeft: '8px',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            {copyCompactLoading ? '⏳ Copying...' : (showCopySuccess ? '✅ Copied!' : '📋 Copy Compact')}
                            <span style={{ fontSize: '10px' }}>▼</span>
                          </button>
                          
                          {exportDropdownOpen && (
                            <div 
                              className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                              onMouseLeave={() => setExportDropdownOpen(false)}
                            >
                              <button
                                onClick={async () => {
                                  setExportDropdownOpen(false);
                                  // Execute the existing copy compact logic for cleaning with full fallback
                                  if (copyCompactLoading) return
                                  setCopyCompactLoading(true)
                                  
                                  const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
                                  if (!evaluationId) {
                                    alert('No evaluation data available to copy')
                                    setCopyCompactLoading(false)
                                    return
                                  }
                                  
                                  console.log('[Copy Compact Cleaning] Starting copy operation...')
                                  
                                  try {
                                    // CRITICAL: Start clipboard operation immediately to preserve user gesture
                                    const clipboardPromise = (async () => {
                                      console.log('[Copy Compact Cleaning] Fetching export data...')
                                      const exportData = await apiClient.exportEvaluation(evaluationId)
                                      console.log('[Copy Compact Cleaning] Export data received:', exportData.evaluation.name)
                                      
                                      // Create compact version
                                      const compactData = {
                                        compact_export: {
                                          exported_at: new Date().toISOString(),
                                          conversation_name: currentConversation?.name || 'Unknown Conversation',
                                          evaluation_name: currentEvaluationName || exportData.evaluation.name,
                                          evaluation_id: evaluationId,
                                          prompt_template_name: exportData.evaluation.prompt_template?.name || currentPromptTemplateName || 'No template',
                                          turns: exportData.turns.map((turn: any) => ({
                                            sequence: turn.sequence,
                                            speaker: turn.speaker,
                                            raw_text: turn.raw_text,
                                            cleaned_text: turn.cleaned_data.cleaned_text
                                          }))
                                        }
                                      }
                                      
                                      const jsonString = JSON.stringify(compactData, null, 2)
                                      console.log('[Copy Compact Cleaning] JSON prepared, length:', jsonString.length)
                                      return { jsonString, exportData, compactData }
                                    })()
                                    
                                    // Use modern clipboard with ClipboardItem to handle large data
                                    if (navigator.clipboard && window.ClipboardItem) {
                                      const clipboardItem = new ClipboardItem({
                                        'text/plain': clipboardPromise.then(result => 
                                          new Blob([result.jsonString], { type: 'text/plain' })
                                        )
                                      })
                                      
                                      await navigator.clipboard.write([clipboardItem])
                                      const result = await clipboardPromise
                                      console.log('[Copy Compact Cleaning] ClipboardItem write successful')
                                      
                                      setShowCopySuccess(true)
                                      setTimeout(() => setShowCopySuccess(false), 3000)
                                      addDetailedLog(`📋 Copied cleaning compact JSON: ${result.exportData.evaluation.name} (${result.compactData.compact_export.turns.length} turns)`)
                                      
                                    } else {
                                      // Fallback: Direct approach for older browsers
                                      const result = await clipboardPromise
                                      
                                      // Try direct clipboard write
                                      if (navigator.clipboard) {
                                        await navigator.clipboard.writeText(result.jsonString)
                                        console.log('[Copy Compact Cleaning] Direct clipboard write successful')
                                      } else {
                                        // Legacy fallback
                                        const textarea = document.createElement('textarea')
                                        textarea.value = result.jsonString
                                        textarea.style.position = 'fixed'
                                        textarea.style.left = '-999999px'
                                        textarea.style.top = '-999999px'
                                        document.body.appendChild(textarea)
                                        textarea.focus()
                                        textarea.select()
                                        
                                        const successful = document.execCommand('copy')
                                        document.body.removeChild(textarea)
                                        
                                        if (!successful) {
                                          throw new Error('Legacy clipboard method failed')
                                        }
                                        console.log('[Copy Compact Cleaning] Legacy clipboard write successful')
                                      }
                                      
                                      setShowCopySuccess(true)
                                      setTimeout(() => setShowCopySuccess(false), 3000)
                                      addDetailedLog(`📋 Copied cleaning compact JSON: ${result.exportData.evaluation.name} (${result.compactData.compact_export.turns.length} turns)`)
                                    }
                                    
                                  } catch (error: any) {
                                    console.error('[Copy Compact Cleaning] Failed:', error)
                                    
                                    // Final fallback: Try to get the data and use document.execCommand
                                    try {
                                      console.log('[Copy Compact Cleaning] Attempting final fallback...')
                                      const exportData = await apiClient.exportEvaluation(evaluationId)
                                      const compactData = {
                                        compact_export: {
                                          exported_at: new Date().toISOString(),
                                          conversation_name: currentConversation?.name || 'Unknown Conversation',
                                          evaluation_name: exportData.evaluation.name,
                                          evaluation_id: evaluationId,
                                          prompt_template_name: exportData.evaluation.prompt_template?.name || currentPromptTemplateName || 'No template',
                                          turns: exportData.turns.map((turn: any) => ({
                                            sequence: turn.sequence,
                                            speaker: turn.speaker,
                                            raw_text: turn.raw_text,
                                            cleaned_text: turn.cleaned_data.cleaned_text
                                          }))
                                        }
                                      }
                                      
                                      const jsonString = JSON.stringify(compactData, null, 2)
                                      const textarea = document.createElement('textarea')
                                      textarea.value = jsonString
                                      textarea.style.position = 'fixed'
                                      textarea.style.left = '-999999px'
                                      textarea.style.top = '-999999px'
                                      document.body.appendChild(textarea)
                                      textarea.focus()
                                      textarea.select()
                                      
                                      const success = document.execCommand('copy')
                                      document.body.removeChild(textarea)
                                      
                                      if (success) {
                                        console.log('[Copy Compact Cleaning] Final fallback successful')
                                        setShowCopySuccess(true)
                                        setTimeout(() => setShowCopySuccess(false), 3000)
                                        addDetailedLog(`📋 Copied cleaning compact JSON (fallback): ${exportData.evaluation.name}`)
                                      } else {
                                        throw new Error('All clipboard methods exhausted')
                                      }
                                    } catch (fallbackError: any) {
                                      console.error('[Copy Compact Cleaning] All methods failed:', fallbackError)
                                      alert(`❌ Copy failed: ${error.message}\n\nData size may be too large (${Math.round((error.data?.length || 500000) / 1024)}KB).\n\nTry using the Export button instead.`)
                                      addDetailedLog(`❌ Copy Compact Cleaning failed completely: ${error.message}`)
                                    }
                                  } finally {
                                    setCopyCompactLoading(false)
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                              >
                                🧹 Cleaning
                              </button>
                              <button
                                onClick={async () => {
                                  setExportDropdownOpen(false);
                                  // Execute function calling export with full fallback system
                                  if (copyCompactLoading) return
                                  setCopyCompactLoading(true)
                                  
                                  const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
                                  if (!evaluationId) {
                                    alert('No evaluation data available to copy')
                                    setCopyCompactLoading(false)
                                    return
                                  }
                                  
                                  console.log('[Copy Compact Function] Starting copy operation...')
                                  
                                  try {
                                    // CRITICAL: Start clipboard operation immediately to preserve user gesture
                                    const clipboardPromise = (async () => {
                                      console.log('[Copy Compact Function] Fetching export data...')
                                      const exportData = await apiClient.exportEvaluation(evaluationId)
                                      console.log('[Copy Compact Function] Export data received:', exportData.evaluation.name)
                                      
                                      // Get function template prompt and tools from a turn with function calls
                                      const turnWithFunctions = cleanedTurns.find(turn => 
                                        turn.function_decision_gemini_call && 
                                        turn.function_decision_gemini_call.model_config?.tools
                                      )
                                      
                                      const functionTemplate = turnWithFunctions?.function_decision_gemini_call?.prompt || "No function template available"
                                      const availableTools = turnWithFunctions?.function_decision_gemini_call?.model_config?.tools || []
                                      
                                      // Get the function template from evaluation data (loaded once per evaluation)
                                      const functionTemplateData = exportData.evaluation.function_template
                                      const functionPromptTemplate = functionTemplateData?.template || "No function template available"
                                      const functionPromptTemplateName = functionTemplateData?.name || "Unknown Function Template"
                                      
                                      // Get all tools with proper structure
                                      const allTools = availableTools.flatMap((toolGroup: any) => 
                                        toolGroup.function_declarations || [toolGroup]
                                      ).map((tool: any) => `- ${tool.name}: ${tool.description || 'No description'} | Parameters: ${JSON.stringify(tool.parameters?.properties || {})}`).join('\n')
                                      
                                      // Create compact turns for ALL turns (not just User)
                                      const compactTurns = cleanedTurns.map((turn, index) => {
                                        const functionResults = turn.function_calls && turn.function_calls.length > 0 
                                          ? turn.function_calls.map(fc => `${fc.function_name}(${JSON.stringify(fc.parameters)}) -> ${fc.success ? 'SUCCESS' : 'FAILED'}`).join(', ')
                                          : 'none'
                                        
                                        return `Turn ${index + 1} [${turn.speaker}]: "${turn.cleaned_text}" | Functions: ${functionResults} | Latency: ${turn.metadata?.processing_time_ms || 0}ms`
                                      })
                                      
                                      const functionCompactData = `═══════════════════════════════════════════════════════════════════
FUNCTION CALLING COMPACT REPORT
═══════════════════════════════════════════════════════════════════
Evaluation: ${currentEvaluationName || exportData.evaluation.name}
Conversation: ${currentConversation?.name || 'Unknown'}
Prompt Name: ${functionPromptTemplateName}
Total Turns: ${cleanedTurns.length}
Export Date: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════════════
FUNCTION CALLING PROMPT TEMPLATE
═══════════════════════════════════════════════════════════════════
${functionPromptTemplate}

═══════════════════════════════════════════════════════════════════
AVAILABLE TOOLS
═══════════════════════════════════════════════════════════════════
${allTools || 'No tools available'}

═══════════════════════════════════════════════════════════════════
CONVERSATION TURNS
═══════════════════════════════════════════════════════════════════
${compactTurns.join('\n')}

═══════════════════════════════════════════════════════════════════`
                                      
                                      console.log('[Copy Compact Function] Compact text prepared, length:', functionCompactData.length)
                                      return { jsonString: functionCompactData, exportData, functionCompactData }
                                    })()
                                    
                                    // Use modern clipboard with ClipboardItem to handle large data
                                    if (navigator.clipboard && window.ClipboardItem) {
                                      const clipboardItem = new ClipboardItem({
                                        'text/plain': clipboardPromise.then(result => 
                                          new Blob([result.jsonString], { type: 'text/plain' })
                                        )
                                      })
                                      
                                      await navigator.clipboard.write([clipboardItem])
                                      const result = await clipboardPromise
                                      console.log('[Copy Compact Function] ClipboardItem write successful')
                                      
                                      setShowCopySuccess(true)
                                      setTimeout(() => setShowCopySuccess(false), 3000)
                                      const turnCount = cleanedTurns.filter(turn => turn.speaker === 'User').length
                                      addDetailedLog(`📋 Copied function calling compact report: ${result.exportData.evaluation.name} (${turnCount} user turns)`)
                                      
                                    } else {
                                      // Fallback: Direct approach for older browsers
                                      const result = await clipboardPromise
                                      
                                      // Try direct clipboard write
                                      if (navigator.clipboard) {
                                        await navigator.clipboard.writeText(result.jsonString)
                                        console.log('[Copy Compact Function] Direct clipboard write successful')
                                      } else {
                                        // Legacy fallback
                                        const textarea = document.createElement('textarea')
                                        textarea.value = result.jsonString
                                        textarea.style.position = 'fixed'
                                        textarea.style.left = '-999999px'
                                        textarea.style.top = '-999999px'
                                        document.body.appendChild(textarea)
                                        textarea.focus()
                                        textarea.select()
                                        
                                        const successful = document.execCommand('copy')
                                        document.body.removeChild(textarea)
                                        
                                        if (!successful) {
                                          throw new Error('Legacy clipboard method failed')
                                        }
                                        console.log('[Copy Compact Function] Legacy clipboard write successful')
                                      }
                                      
                                      setShowCopySuccess(true)
                                      setTimeout(() => setShowCopySuccess(false), 3000)
                                      const turnCount = cleanedTurns.filter(turn => turn.speaker === 'User').length
                                      addDetailedLog(`📋 Copied function calling compact report: ${result.exportData.evaluation.name} (${turnCount} user turns)`)
                                    }
                                    
                                  } catch (error: any) {
                                    console.error('[Copy Compact Function] Failed:', error)
                                    
                                    // Final fallback: Try to get the data and use document.execCommand
                                    try {
                                      console.log('[Copy Compact Function] Attempting final fallback...')
                                      const exportData = await apiClient.exportEvaluation(evaluationId)
                                      
                                      // Get function template prompt and tools from a turn with function calls
                                      const turnWithFunctions = cleanedTurns.find(turn => 
                                        turn.function_decision_gemini_call && 
                                        turn.function_decision_gemini_call.model_config?.tools
                                      )
                                      
                                      const functionTemplate = turnWithFunctions?.function_decision_gemini_call?.prompt || "No function template available"
                                      const availableTools = turnWithFunctions?.function_decision_gemini_call?.model_config?.tools || []
                                      
                                      // Get the function template from evaluation data (fallback)
                                      const functionTemplateDataFallback = exportData.evaluation.function_template
                                      const functionPromptTemplateFallback = functionTemplateDataFallback?.template || "No function template available"
                                      const functionPromptTemplateNameFallback = functionTemplateDataFallback?.name || "Unknown Function Template"
                                      
                                      // Get all tools with proper structure
                                      const allToolsFallback = availableTools.flatMap((toolGroup: any) => 
                                        toolGroup.function_declarations || [toolGroup]
                                      ).map((tool: any) => `- ${tool.name}: ${tool.description || 'No description'} | Parameters: ${JSON.stringify(tool.parameters?.properties || {})}`).join('\n')
                                      
                                      // Create compact turns for ALL turns (not just User)
                                      const compactTurnsFallback = cleanedTurns.map((turn, index) => {
                                        const functionResults = turn.function_calls && turn.function_calls.length > 0 
                                          ? turn.function_calls.map(fc => `${fc.function_name}(${JSON.stringify(fc.parameters)}) -> ${fc.success ? 'SUCCESS' : 'FAILED'}`).join(', ')
                                          : 'none'
                                        
                                        return `Turn ${index + 1} [${turn.speaker}]: "${turn.cleaned_text}" | Functions: ${functionResults} | Latency: ${turn.metadata?.processing_time_ms || 0}ms`
                                      })
                                      
                                      const functionCompactData = `═══════════════════════════════════════════════════════════════════
FUNCTION CALLING COMPACT REPORT
═══════════════════════════════════════════════════════════════════
Evaluation: ${exportData.evaluation.name}
Conversation: ${currentConversation?.name || 'Unknown'}
Prompt Name: ${functionPromptTemplateNameFallback}
Total Turns: ${cleanedTurns.length}
Export Date: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════════════
FUNCTION CALLING PROMPT TEMPLATE
═══════════════════════════════════════════════════════════════════
${functionPromptTemplateFallback}

═══════════════════════════════════════════════════════════════════
AVAILABLE TOOLS
═══════════════════════════════════════════════════════════════════
${allToolsFallback || 'No tools available'}

═══════════════════════════════════════════════════════════════════
CONVERSATION TURNS
═══════════════════════════════════════════════════════════════════
${compactTurnsFallback.join('\n')}

═══════════════════════════════════════════════════════════════════`
                                      
                                      const jsonString = functionCompactData
                                      const textarea = document.createElement('textarea')
                                      textarea.value = jsonString
                                      textarea.style.position = 'fixed'
                                      textarea.style.left = '-999999px'
                                      textarea.style.top = '-999999px'
                                      document.body.appendChild(textarea)
                                      textarea.focus()
                                      textarea.select()
                                      
                                      const success = document.execCommand('copy')
                                      document.body.removeChild(textarea)
                                      
                                      if (success) {
                                        console.log('[Copy Compact Function] Final fallback successful')
                                        setShowCopySuccess(true)
                                        setTimeout(() => setShowCopySuccess(false), 3000)
                                        addDetailedLog(`📋 Copied function calling compact JSON (fallback): ${exportData.evaluation.name}`)
                                      } else {
                                        throw new Error('All clipboard methods exhausted')
                                      }
                                    } catch (fallbackError: any) {
                                      console.error('[Copy Compact Function] All methods failed:', fallbackError)
                                      alert(`❌ Copy failed: ${error.message}\n\nData size may be too large (${Math.round((error.data?.length || 500000) / 1024)}KB).\n\nTry using the Export button instead.`)
                                      addDetailedLog(`❌ Copy Compact Function failed completely: ${error.message}`)
                                    }
                                  } finally {
                                    setCopyCompactLoading(false)
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                              >
                                ⚙️ Function Calling
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Old Copy Compact Button - Remove this entire section */}
                      {false && cleanedTurns.length > 0 && !isProcessing && (
                        <button
                          onClick={async () => {
                            // Prevent multiple rapid clicks and show loading
                            if (copyCompactLoading) return
                            setCopyCompactLoading(true)
                            
                            // Find the current evaluation ID from the loaded data
                            const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
                            if (!evaluationId) {
                              alert('No evaluation data available to copy')
                              setCopyCompactLoading(false)
                              return
                            }
                            
                            console.log('[Copy Compact] Starting copy operation... v3.0 - Immediate clipboard approach')
                            
                            try {
                              // CRITICAL: Start clipboard operation immediately to preserve user gesture
                              const clipboardPromise = (async () => {
                                console.log('[Copy Compact] Fetching export data...')
                                const exportData = await apiClient.exportEvaluation(evaluationId)
                                console.log('[Copy Compact] Export data received:', exportData.evaluation.name)
                                
                                // Create compact version
                                const compactData = {
                                  compact_export: {
                                    exported_at: new Date().toISOString(),
                                    conversation_name: currentConversation?.name || 'Unknown Conversation',
                                    evaluation_name: exportData.evaluation.name,
                                    evaluation_id: evaluationId,
                                    prompt_template_name: exportData.evaluation.prompt_template?.name || currentPromptTemplateName || 'No template',
                                    turns: exportData.turns.map((turn: any) => ({
                                      sequence: turn.sequence,
                                      speaker: turn.speaker,
                                      raw_text: turn.raw_text,
                                      cleaned_text: turn.cleaned_data.cleaned_text
                                    }))
                                  }
                                }
                                
                                const jsonString = JSON.stringify(compactData, null, 2)
                                console.log('[Copy Compact] JSON prepared, length:', jsonString.length)
                                return { jsonString, exportData, compactData }
                              })()
                              
                              // Use modern clipboard with ClipboardItem to handle large data
                              if (navigator.clipboard && window.ClipboardItem) {
                                const clipboardItem = new ClipboardItem({
                                  'text/plain': clipboardPromise.then(result => 
                                    new Blob([result.jsonString], { type: 'text/plain' })
                                  )
                                })
                                
                                await navigator.clipboard.write([clipboardItem])
                                const result = await clipboardPromise
                                console.log('[Copy Compact] ClipboardItem write successful')
                                
                                setShowCopySuccess(true)
                                setTimeout(() => setShowCopySuccess(false), 3000)
                                addDetailedLog(`📋 Copied compact JSON to clipboard: ${result.exportData.evaluation.name} (${result.compactData.compact_export.turns.length} turns)`)
                                
                              } else {
                                // Fallback: Direct approach for older browsers
                                const result = await clipboardPromise
                                
                                // Try direct clipboard write
                                if (navigator.clipboard) {
                                  await navigator.clipboard.writeText(result.jsonString)
                                  console.log('[Copy Compact] Direct clipboard write successful')
                                } else {
                                  // Legacy fallback
                                  const textarea = document.createElement('textarea')
                                  textarea.value = result.jsonString
                                  textarea.style.position = 'fixed'
                                  textarea.style.left = '-999999px'
                                  textarea.style.top = '-999999px'
                                  document.body.appendChild(textarea)
                                  textarea.focus()
                                  textarea.select()
                                  
                                  const successful = document.execCommand('copy')
                                  document.body.removeChild(textarea)
                                  
                                  if (!successful) {
                                    throw new Error('Legacy clipboard method failed')
                                  }
                                  console.log('[Copy Compact] Legacy clipboard write successful')
                                }
                                
                                setShowCopySuccess(true)
                                setTimeout(() => setShowCopySuccess(false), 3000)
                                addDetailedLog(`📋 Copied compact JSON to clipboard: ${result.exportData.evaluation.name} (${result.compactData.compact_export.turns.length} turns)`)
                              }
                              
                            } catch (error: any) {
                              console.error('[Copy Compact] Failed:', error)
                              
                              // Final fallback: Try to get the data and use document.execCommand
                              try {
                                console.log('[Copy Compact] Attempting final fallback...')
                                const exportData = await apiClient.exportEvaluation(evaluationId)
                                const compactData = {
                                  compact_export: {
                                    exported_at: new Date().toISOString(),
                                    conversation_name: currentConversation?.name || 'Unknown Conversation',
                                    evaluation_name: exportData.evaluation.name,
                                    evaluation_id: evaluationId,
                                    prompt_template_name: exportData.evaluation.prompt_template?.name || currentPromptTemplateName || 'No template',
                                    turns: exportData.turns.map((turn: any) => ({
                                      sequence: turn.sequence,
                                      speaker: turn.speaker,
                                      raw_text: turn.raw_text,
                                      cleaned_text: turn.cleaned_data.cleaned_text
                                    }))
                                  }
                                }
                                const jsonString = JSON.stringify(compactData, null, 2)
                                
                                // Force focus and try execCommand
                                window.focus()
                                document.body.focus()
                                
                                const textarea = document.createElement('textarea')
                                textarea.value = jsonString
                                textarea.style.position = 'absolute'
                                textarea.style.left = '0'
                                textarea.style.top = '0'
                                textarea.style.width = '1px'
                                textarea.style.height = '1px'
                                textarea.style.opacity = '0'
                                document.body.appendChild(textarea)
                                textarea.focus()
                                textarea.select()
                                
                                const success = document.execCommand('copy')
                                document.body.removeChild(textarea)
                                
                                if (success) {
                                  console.log('[Copy Compact] Final fallback successful')
                                  setShowCopySuccess(true)
                                  setTimeout(() => setShowCopySuccess(false), 3000)
                                  addDetailedLog(`📋 Copied compact JSON (fallback): ${exportData.evaluation.name}`)
                                } else {
                                  throw new Error('All clipboard methods exhausted')
                                }
                              } catch (fallbackError: any) {
                                console.error('[Copy Compact] All methods failed:', fallbackError)
                                alert(`❌ Copy failed: ${error.message}\n\nData size may be too large (${Math.round((error.data?.length || 500000) / 1024)}KB).\n\nTry using the Export button instead.`)
                                addDetailedLog(`❌ Copy Compact failed completely: ${error.message}`)
                              }
                            } finally {
                              setCopyCompactLoading(false)
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: copyCompactLoading ? '#6b7280' : (showCopySuccess ? '#10b981' : '#3b82f6'),
                            color: 'white',
                            cursor: copyCompactLoading ? 'not-allowed' : 'pointer',
                            opacity: copyCompactLoading ? 0.7 : 1,
                            marginLeft: '8px',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          {copyCompactLoading ? '⏳ Copying...' : (showCopySuccess ? '✅ Copied!' : '📋 Copy Compact')}
                        </button>
                      )}
                      
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
                      </div>

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
                    fontSize: '14px' 
                  }}>
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
                            // Show three-card layout for completed processing
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: window.innerWidth > 1400 ? '1fr 1fr 1fr' : 
                                                   window.innerWidth > 900 ? '1fr 1fr' :
                                                   '1fr',
                              gap: '16px', 
                              marginBottom: '16px' 
                            }}>
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
                              
                              {/* Function Calls Card */}
                              <div style={{ 
                                backgroundColor: theme.bg, 
                                borderRadius: '6px', 
                                padding: '16px',
                                border: `2px solid ${
                                  turn.function_decision?.error ? '#ef4444' :
                                  (turn.function_calls && turn.function_calls.length > 0) ? theme.accent : 
                                  theme.border
                                }`,
                                gridColumn: window.innerWidth <= 900 ? '1' : 
                                           window.innerWidth <= 1400 ? '1 / -1' : 
                                           'auto'
                              }}>
                                <div style={{ 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: turn.function_decision?.error ? '#ef4444' :
                                         (turn.function_calls && turn.function_calls.length > 0) ? theme.accent : 
                                         theme.textMuted, 
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  marginBottom: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  FUNCTION CALLS
                                  {turn.function_decision?.error ? (
                                    <span style={{
                                      backgroundColor: '#ef4444',
                                      color: 'white',
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontWeight: '500'
                                    }}>
                                      ERROR
                                    </span>
                                  ) : (
                                    <span style={{
                                      backgroundColor: (turn.function_calls && turn.function_calls.length > 0) ? theme.accent : theme.textMuted,
                                      color: 'white',
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontWeight: '500'
                                    }}>
                                      {turn.function_calls?.length || 0}
                                    </span>
                                  )}
                                </div>
                                
                                {turn.function_decision?.error ? (
                                  /* Show Error State */
                                  <div style={{ 
                                    backgroundColor: '#fef2f2',
                                    borderRadius: '4px',
                                    padding: '16px',
                                    border: `1px solid #fca5a5`
                                  }}>
                                    <div style={{ 
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      color: '#dc2626',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      ⚠️ Function Calling Failed
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#b91c1c',
                                      marginBottom: '12px',
                                      lineHeight: '1.4'
                                    }}>
                                      {turn.function_decision.error}
                                    </div>
                                    
                                    {/* Show raw response if available */}
                                    {turn.function_decision.raw_response && (
                                      <details style={{ marginTop: '8px' }}>
                                        <summary style={{ 
                                          fontSize: '11px', 
                                          color: '#7f1d1d', 
                                          cursor: 'pointer',
                                          marginBottom: '6px'
                                        }}>
                                          View Raw AI Response
                                        </summary>
                                        <div style={{
                                          fontSize: '10px',
                                          fontFamily: 'monospace',
                                          color: theme.textSecondary,
                                          backgroundColor: '#f3f4f6',
                                          padding: '8px',
                                          borderRadius: '3px',
                                          maxHeight: '200px',
                                          overflowY: 'auto',
                                          border: `1px solid ${theme.border}`
                                        }}>
                                          {turn.function_decision.raw_response}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                ) : turn.function_calls && turn.function_calls.length > 0 ? (
                                  <div>
                                    {/* Thought Process */}
                                    {turn.function_decision?.thought_process && (
                                      <div style={{ 
                                        backgroundColor: theme.bgSecondary,
                                        borderRadius: '4px',
                                        padding: '12px',
                                        marginBottom: '12px',
                                        border: `1px solid ${theme.border}`
                                      }}>
                                        <div style={{ 
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          color: theme.textSecondary,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em',
                                          marginBottom: '6px'
                                        }}>
                                          AI REASONING
                                        </div>
                                        <div style={{
                                          fontSize: '13px',
                                          color: theme.text,
                                          lineHeight: '1.4',
                                          fontStyle: 'italic'
                                        }}>
                                          {turn.function_decision.thought_process}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Function Calls List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {turn.function_calls.map((func, index) => (
                                        <div key={index} style={{
                                          backgroundColor: func.success ? '#f0fdf4' : '#fef2f2',
                                          border: `1px solid ${func.success ? '#22c55e' : '#ef4444'}`,
                                          borderRadius: '4px',
                                          padding: '10px'
                                        }}>
                                          <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between',
                                            marginBottom: '6px'
                                          }}>
                                            <span style={{
                                              fontSize: '13px',
                                              fontWeight: '600',
                                              color: func.success ? '#16a34a' : '#dc2626'
                                            }}>
                                              {func.function_name}
                                            </span>
                                            <span style={{
                                              fontSize: '11px',
                                              color: theme.textMuted,
                                              fontFamily: 'monospace'
                                            }}>
                                              {func.execution_time_ms}ms
                                            </span>
                                          </div>
                                          
                                          {/* Parameters */}
                                          {Object.keys(func.parameters).length > 0 && (
                                            <div style={{ marginBottom: '6px' }}>
                                              <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '4px' }}>
                                                PARAMETERS:
                                              </div>
                                              <div style={{
                                                fontSize: '11px',
                                                fontFamily: 'monospace',
                                                color: theme.textSecondary,
                                                backgroundColor: theme.bgTertiary,
                                                padding: '4px 6px',
                                                borderRadius: '2px'
                                              }}>
                                                {JSON.stringify(func.parameters, null, 2)}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Result or Error */}
                                          {func.success && func.result && (
                                            <div>
                                              <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '4px' }}>
                                                RESULT:
                                              </div>
                                              <div style={{
                                                fontSize: '11px',
                                                color: '#16a34a',
                                                fontWeight: '500'
                                              }}>
                                                {func.result.message || 'Function executed successfully'}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {!func.success && func.error && (
                                            <div>
                                              <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '4px' }}>
                                                ERROR:
                                              </div>
                                              <div style={{
                                                fontSize: '11px',
                                                color: '#dc2626',
                                                fontWeight: '500',
                                                marginBottom: '8px'
                                              }}>
                                                {func.error_type && `${func.error_type}: `}{func.error}
                                              </div>
                                              
                                              {/* Show detailed error information for debugging */}
                                              {func.error_details && (
                                                <details style={{ marginTop: '8px' }}>
                                                  <summary style={{ 
                                                    fontSize: '10px', 
                                                    color: '#7f1d1d', 
                                                    cursor: 'pointer',
                                                    marginBottom: '6px'
                                                  }}>
                                                    View Error Details
                                                  </summary>
                                                  <div style={{
                                                    fontSize: '10px',
                                                    fontFamily: 'monospace',
                                                    color: theme.textSecondary,
                                                    backgroundColor: '#f3f4f6',
                                                    padding: '8px',
                                                    borderRadius: '3px',
                                                    maxHeight: '300px',
                                                    overflowY: 'auto',
                                                    border: `1px solid ${theme.border}`
                                                  }}>
                                                    <div style={{ marginBottom: '8px', fontWeight: '600', color: '#dc2626' }}>
                                                      Failed Function Call:
                                                    </div>
                                                    <pre style={{ margin: '0 0 12px 0', fontSize: '9px' }}>
                                                      {JSON.stringify(func.error_details.failed_function_call, null, 2)}
                                                    </pre>
                                                    
                                                    <div style={{ marginBottom: '8px', fontWeight: '600', color: '#dc2626' }}>
                                                      Stack Trace:
                                                    </div>
                                                    <pre style={{ margin: 0, fontSize: '9px', lineHeight: '1.2' }}>
                                                      {func.error_details.full_traceback}
                                                    </pre>
                                                  </div>
                                                </details>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ 
                                    color: theme.textMuted, 
                                    lineHeight: '1.6', 
                                    fontSize: '14px',
                                    textAlign: 'center',
                                    padding: '24px 0'
                                  }}>
                                    No functions called for this turn
                                  </div>
                                )}
                                
                                <div style={{ 
                                  fontSize: '11px', 
                                  color: theme.textMuted, 
                                  marginTop: '8px',
                                  fontFamily: 'monospace',
                                  textAlign: 'center'
                                }}>
                                  Function execution: {turn.function_decision?.total_execution_time_ms || 0}ms
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: `${getSpacing(16)}px`, fontSize: '14px' }}>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Model:</div>
                                    <div style={{ color: theme.textMuted, fontFamily: 'monospace', fontSize: '12px' }}>{turn.metadata.ai_model_used || 'bypass'}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Cost:</div>
                                    <div style={{ color: theme.textMuted, fontFamily: 'monospace', position: 'relative' }}>
                                      {turn.cost_breakdown ? (
                                        <>
                                          <span 
                                            style={{ 
                                              cursor: 'pointer',
                                              borderBottom: '2px dotted rgba(150, 150, 150, 0.5)',
                                              position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                              const tooltip = document.createElement('div');
                                              tooltip.style.cssText = `
                                                position: absolute;
                                                bottom: 100%;
                                                left: 50%;
                                                transform: translateX(-50%);
                                                background: rgba(0, 0, 0, 0.9);
                                                color: white;
                                                padding: 8px 12px;
                                                border-radius: 4px;
                                                font-size: 12px;
                                                white-space: pre-line;
                                                z-index: 1000;
                                                margin-bottom: 5px;
                                                font-family: monospace;
                                              `;
                                              tooltip.textContent = `Cleaning: $${turn.cost_breakdown?.cleaning_cost_usd.toFixed(6)}\nFunction: $${turn.cost_breakdown?.function_cost_usd.toFixed(6)}\nTotal: $${turn.cost_breakdown?.total_cost_usd.toFixed(6)}`;
                                              e.currentTarget.appendChild(tooltip);
                                            }}
                                            onMouseLeave={(e) => {
                                              const tooltip = e.currentTarget.querySelector('div');
                                              if (tooltip) tooltip.remove();
                                            }}
                                          >
                                            ${turn.cost_breakdown.total_cost_usd.toFixed(6)}
                                          </span>
                                        </>
                                      ) : turn.cost_usd ? (
                                        `$${turn.cost_usd.toFixed(6)}`
                                      ) : (
                                        'not available'
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '500', color: theme.text }}>Tokens:</div>
                                    <div style={{ color: theme.textMuted, fontFamily: 'monospace', position: 'relative' }}>
                                      {turn.cost_breakdown ? (
                                        <>
                                          <span 
                                            style={{ 
                                              cursor: 'pointer',
                                              borderBottom: '2px dotted rgba(150, 150, 150, 0.5)',
                                              position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                              const tooltip = document.createElement('div');
                                              tooltip.style.cssText = `
                                                position: absolute;
                                                bottom: 100%;
                                                left: 50%;
                                                transform: translateX(-50%);
                                                background: rgba(0, 0, 0, 0.9);
                                                color: white;
                                                padding: 8px 12px;
                                                border-radius: 4px;
                                                font-size: 12px;
                                                white-space: pre-line;
                                                z-index: 1000;
                                                margin-bottom: 5px;
                                                font-family: monospace;
                                              `;
                                              tooltip.textContent = `Cleaning: ${turn.cost_breakdown?.cleaning_tokens.total_tokens}\nFunction: ${turn.cost_breakdown?.function_tokens.total_tokens}\nTotal: ${turn.cost_breakdown?.total_tokens}`;
                                              e.currentTarget.appendChild(tooltip);
                                            }}
                                            onMouseLeave={(e) => {
                                              const tooltip = e.currentTarget.querySelector('div');
                                              if (tooltip) tooltip.remove();
                                            }}
                                          >
                                            {turn.cost_breakdown.total_tokens.toString()}
                                          </span>
                                        </>
                                      ) : turn.token_usage ? (
                                        `${turn.token_usage}`
                                      ) : (
                                        'not available'
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: theme.textMuted, fontStyle: 'italic' }}>
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
                                2. Backend → Google: {turnGroup.geminiFunctionCall.function_call} ({turnGroup.geminiFunctionCall.model_config && typeof turnGroup.geminiFunctionCall.model_config === 'object' && 'model_name' in turnGroup.geminiFunctionCall.model_config ? (turnGroup.geminiFunctionCall.model_config as any).model_name : 'unknown model'})
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
                            {/* Function calling steps */}
                            {turnGroup.functionDecisionCall && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                5. Backend → Google: {turnGroup.functionDecisionCall.function_call} ({turnGroup.functionDecisionCall.latency_ms}ms)
                              </div>
                            )}
                            {turnGroup.functionDecisionCall && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                6. Google → Backend: Function decision (success: {turnGroup.functionDecisionCall.success ? 'true' : 'false'})
                              </div>
                            )}
                            {turnGroup.functionExecutions && turnGroup.functionExecutions.length > 0 && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                7. Backend → Functions: Executing {turnGroup.functionExecutions.length} function(s) ({turnGroup.functionExecutions.reduce((total, func) => total + func.execution_time_ms, 0)}ms total)
                              </div>
                            )}
                            {turnGroup.functionExecutions && turnGroup.functionExecutions.length > 0 && (
                              <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                                8. Functions → Backend: Results ({turnGroup.functionExecutions.filter(f => f.success).length} successful, {turnGroup.functionExecutions.filter(f => !f.success).length} failed)
                              </div>
                            )}
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
                                    processing_time_ms: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'metadata' in turnGroup.backendResponse.response_data && turnGroup.backendResponse.response_data.metadata && typeof turnGroup.backendResponse.response_data.metadata === 'object' && 'processing_time_ms' in turnGroup.backendResponse.response_data.metadata) ? (turnGroup.backendResponse.response_data.metadata as any).processing_time_ms : 'N/A',
                                    timing_breakdown: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'timing_breakdown' in turnGroup.backendResponse.response_data) ? (turnGroup.backendResponse.response_data as any).timing_breakdown : 'No timing data',
                                    ai_model_used: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'metadata' in turnGroup.backendResponse.response_data && turnGroup.backendResponse.response_data.metadata && typeof turnGroup.backendResponse.response_data.metadata === 'object' && 'ai_model_used' in turnGroup.backendResponse.response_data.metadata) ? (turnGroup.backendResponse.response_data.metadata as any).ai_model_used : 'N/A',
                                    cleaning_level: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'metadata' in turnGroup.backendResponse.response_data && turnGroup.backendResponse.response_data.metadata && typeof turnGroup.backendResponse.response_data.metadata === 'object' && 'cleaning_level' in turnGroup.backendResponse.response_data.metadata) ? (turnGroup.backendResponse.response_data.metadata as any).cleaning_level : 'N/A',
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
                                    cleaned_text: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'cleaned_text' in turnGroup.backendResponse.response_data) ? (turnGroup.backendResponse.response_data as any).cleaned_text : 'No cleaned text',
                                    corrections: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'metadata' in turnGroup.backendResponse.response_data && turnGroup.backendResponse.response_data.metadata && typeof turnGroup.backendResponse.response_data.metadata === 'object' && 'corrections' in turnGroup.backendResponse.response_data.metadata) ? (turnGroup.backendResponse.response_data.metadata as any).corrections : [],
                                    context_detected: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'metadata' in turnGroup.backendResponse.response_data && turnGroup.backendResponse.response_data.metadata && typeof turnGroup.backendResponse.response_data.metadata === 'object' && 'context_detected' in turnGroup.backendResponse.response_data.metadata) ? (turnGroup.backendResponse.response_data.metadata as any).context_detected : 'N/A',
                                    gemini_prompt: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'gemini_prompt' in turnGroup.backendResponse.response_data && typeof (turnGroup.backendResponse.response_data as any).gemini_prompt === 'string') ? (turnGroup.backendResponse.response_data as any).gemini_prompt.substring(0, 200) + '...' : 'No prompt',
                                    gemini_response: (turnGroup.backendResponse.response_data && typeof turnGroup.backendResponse.response_data === 'object' && 'gemini_response' in turnGroup.backendResponse.response_data && typeof (turnGroup.backendResponse.response_data as any).gemini_response === 'string') ? (turnGroup.backendResponse.response_data as any).gemini_response.substring(0, 200) + '...' : 'No response'
                                  }, null, 2)}
                                </pre>
                              </div>
                            </details>

                            {/* 5. Function Decision Call */}
                            {turnGroup.functionDecisionCall && (
                              <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                                <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                  🟣 5. Function Decision Call
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
                                      function_call: turnGroup.functionDecisionCall.function_call,
                                      model_config: turnGroup.functionDecisionCall.model_config,
                                      latency_ms: turnGroup.functionDecisionCall.latency_ms,
                                      success: turnGroup.functionDecisionCall.success,
                                      prompt_preview: typeof turnGroup.functionDecisionCall.prompt === 'string' ? turnGroup.functionDecisionCall.prompt.substring(0, 200) + '...' : 'No prompt',
                                      response_preview: typeof turnGroup.functionDecisionCall.response === 'string' ? turnGroup.functionDecisionCall.response.substring(0, 200) + '...' : 'No response'
                                    }, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}

                            {/* 6. Function Executions */}
                            {turnGroup.functionExecutions && turnGroup.functionExecutions.length > 0 && (
                              <details style={{ border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '12px' }}>
                                <summary style={{ fontSize: '14px', fontWeight: '500', color: theme.text, cursor: 'pointer', marginBottom: '8px' }}>
                                  🟡 6. Function Executions ({turnGroup.functionExecutions.length} functions)
                                </summary>
                                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '4px' }}>
                                  <pre style={{ 
                                    fontSize: '11px', 
                                    fontFamily: 'monospace', 
                                    color: theme.text,
                                    margin: 0,
                                    overflowX: 'auto',
                                    maxHeight: '300px'
                                  }}>
                                    {JSON.stringify(turnGroup.functionExecutions.map(func => ({
                                      function_name: func.function_name,
                                      parameters: func.parameters,
                                      success: func.success,
                                      execution_time_ms: func.execution_time_ms,
                                      error: func.error,
                                      result_preview: func.result ? JSON.stringify(func.result).substring(0, 100) + '...' : 'No result'
                                    })), null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}
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
            
            {selectedTab === 'cleaner-config' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ maxWidth: '512px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, marginBottom: '24px' }}>Cleaner Configuration</h3>
                    
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
                                
                                {/* Integrated Template Variables - shown right after template preview */}
                                {settings.promptTemplate.variables && 
                                 settings.promptTemplate.variables.some((v: string) => ['call_context', 'additional_context'].includes(v)) && (
                                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: darkMode ? '#1e3a8a20' : '#dbeafe', borderRadius: '8px', border: `2px solid ${darkMode ? '#3b82f6' : '#60a5fa'}` }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: darkMode ? '#60a5fa' : '#1d4ed8', marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
                                      <svg style={{ width: '16px', height: '16px', marginRight: '6px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Template Variables
                                      <span style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '10px', backgroundColor: darkMode ? '#3b82f6' : '#2563eb', color: 'white', borderRadius: '12px' }}>
                                        Optional
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      {settings.promptTemplate.variables.includes('call_context') && (
                                        <div>
                                          <VariableInput
                                            variable="call_context"
                                            value={settings.callContext}
                                            onChange={(value) => setSettings({...settings, callContext: value})}
                                            placeholder="Enter business context from prequalification flow..."
                                            className="w-full"
                                          />
                                        </div>
                                      )}
                                      {settings.promptTemplate.variables.includes('additional_context') && (
                                        <div>
                                          <VariableInput
                                            variable="additional_context"
                                            value={settings.additionalContext}
                                            onChange={(value) => setSettings({...settings, additionalContext: value})}
                                            placeholder="Enter additional context for cleaning..."
                                            className="w-full"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
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
            
            {selectedTab === 'function-config' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ maxWidth: '512px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', color: theme.text, marginBottom: '24px' }}>Function Caller Configuration</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>Function Window Settings</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                                  Function Window: {settings.functionWindowSize} turns
                                </label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type="range"
                                    min="0"
                                    max="30"
                                    value={settings.functionWindowSize}
                                    onChange={(e) => setSettings({...settings, functionWindowSize: parseInt(e.target.value)})}
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
                                    <span>10</span>
                                    <span>20</span>
                                    <span>Max</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                                  Include previous {settings.functionWindowSize} turns for function calling context
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '500', color: theme.text, marginBottom: '12px' }}>AI Model Settings</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: theme.textSecondary, marginBottom: '8px' }}>
                                  Model Name
                                </label>
                                <input 
                                  type="text"
                                  value={settings.functionModelName}
                                  onChange={(e) => setSettings({...settings, functionModelName: e.target.value})}
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
                                  Function Prompt Template
                                </label>
                                <select 
                                  value={settings.functionPromptTemplate?.id || ''}
                                  onChange={(e) => handleFunctionTemplateChange(e.target.value)}
                                  disabled={loadingFunctionTemplates}
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
                                  <option value="">Default Function Prompt</option>
                                  {functionPromptTemplates.map(template => (
                                    <option key={template.id} value={template.id}>
                                      {template.name} ({template.variables?.length || 0} variables)
                                    </option>
                                  ))}
                                </select>
                                {loadingFunctionTemplates && (
                                  <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                                    Loading function templates...
                                  </div>
                                )}
                                {settings.functionPromptTemplate && (
                                  <div style={{ marginTop: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '500', color: theme.textSecondary, marginBottom: '4px' }}>
                                      Template Preview:
                                    </div>
                                    <textarea
                                      value={selectedFunctionTemplatePreview}
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
                                      Variables: {settings.functionPromptTemplate.variables?.join(', ') || 'None'}
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
                                  Temperature: {settings.functionTemperature}
                                </label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="2"
                                  step="0.1"
                                  value={settings.functionTemperature}
                                  onChange={(e) => setSettings({...settings, functionTemperature: parseFloat(e.target.value)})}
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
                                  Top-p: {settings.functionTopP}
                                </label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={settings.functionTopP}
                                  onChange={(e) => setSettings({...settings, functionTopP: parseFloat(e.target.value)})}
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
                                  Top-k: {settings.functionTopK}
                                </label>
                                <input 
                                  type="range"
                                  min="1"
                                  max="100"
                                  value={settings.functionTopK}
                                  onChange={(e) => setSettings({...settings, functionTopK: parseInt(e.target.value)})}
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
                                  Max Tokens: {settings.functionMaxTokens}
                                </label>
                                <input 
                                  type="range"
                                  min="1000"
                                  max="65535"
                                  step="1000"
                                  value={settings.functionMaxTokens}
                                  onChange={(e) => setSettings({...settings, functionMaxTokens: parseInt(e.target.value)})}
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
          turnData={{
            ...inspectedTurn,
            metadata: {
              ...inspectedTurn.metadata,
              confidence_score: 'UNKNOWN' // Legacy field for backwards compatibility with inspector
            },
            function_calls: inspectedTurn.function_calls?.map(call => ({
              function_name: call.function_name,
              parameters: call.parameters,
              result: call.result ?? {},
              success: call.success,
              confidence_score: 'UNKNOWN', // Legacy field for backwards compatibility
            })),
            function_decision: inspectedTurn.function_decision ? {
              reasoning: inspectedTurn.function_decision.thought_process || 'No reasoning provided',
              calls_count: inspectedTurn.function_calls?.length ?? 0,
              processing_time_ms: inspectedTurn.function_decision.total_execution_time_ms || 0
            } : undefined,
            function_decision_gemini_call: inspectedTurn.function_decision_gemini_call ? {
              prompt: inspectedTurn.function_decision_gemini_call.prompt || '',
              response: inspectedTurn.function_decision_gemini_call.response || '',
              model_config: inspectedTurn.function_decision_gemini_call.model_config || {},
              timestamp: inspectedTurn.function_decision_gemini_call.timestamp || Date.now(),
              success: inspectedTurn.function_decision_gemini_call.success || false
            } : undefined
          }}
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
                                {hasEvaluations && latestEvaluation ? (
                                  `${evaluations.length} evaluation${evaluations.length > 1 ? 's' : ''}, last: ${new Date(latestEvaluation.created_at).toLocaleString()}`
                                ) : (
                                  'No evaluations'
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                {hasEvaluations && (
                                  <>
                                    <button
                                      onClick={() => loadLatestEvaluation(conversation)}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: loadingEvaluation ? '#6b7280' : theme.accent,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: loadingEvaluation ? 'not-allowed' : 'pointer',
                                        flex: loadingEvaluation ? 2 : 1,
                                        opacity: loadingEvaluation ? 0.7 : 1
                                      }}
                                      disabled={loadingEvaluation}
                                    >
                                      {loadingEvaluation ? (loadingProgress || '⏳ Loading...') : '📊 Load Latest'}
                                    </button>
                                    {loadingEvaluation && (
                                      <button
                                        onClick={cancelEvaluationLoad}
                                        style={{
                                          padding: '6px 8px',
                                          backgroundColor: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '500',
                                          cursor: 'pointer',
                                          marginLeft: '4px'
                                        }}
                                      >
                                        ✕ Cancel
                                      </button>
                                    )}
                                  </>
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
                          try {
                            const exportData = await apiClient.exportEvaluation(evaluation.id)
                            
                            // Create and download the file
                            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${exportData.conversation.name.replace(/[^a-zA-Z0-9]/g, '_')}_${exportData.evaluation.id}.json`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            
                            addDetailedLog(`📥 Exported evaluation: ${evaluation.name}`)
                          } catch (error) {
                            console.error('Failed to export evaluation:', error)
                            alert('Failed to export evaluation')
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        📥 Export
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            // Use ClipboardItem with Promise to maintain user gesture context
                            if (navigator.clipboard && window.ClipboardItem) {
                              const textPromise = apiClient.exportEvaluation(evaluation.id)
                                .then(exportData => {
                                  const jsonString = JSON.stringify(exportData, null, 2)
                                  addDetailedLog(`📋 Copied evaluation JSON to clipboard: ${evaluation.name}`)
                                  return new Blob([jsonString], { type: 'text/plain' })
                                })
                              
                              const clipboardItem = new ClipboardItem({
                                'text/plain': textPromise
                              })
                              
                              await navigator.clipboard.write([clipboardItem])
                              alert('Evaluation JSON copied to clipboard!')
                            } else {
                              // Fallback: Use the same simple approach as Copy Logs
                              const exportData = await apiClient.exportEvaluation(evaluation.id)
                              const jsonString = JSON.stringify(exportData, null, 2)
                              await navigator.clipboard.writeText(jsonString)
                              alert('Evaluation JSON copied to clipboard!')
                              addDetailedLog(`📋 Copied evaluation JSON to clipboard: ${evaluation.name}`)
                            }
                          } catch (error) {
                            console.error('Failed to copy evaluation:', error)
                            alert('Failed to copy evaluation. Please try the Export button instead.')
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        📋 Copy
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: theme.textMuted }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
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
                    {evaluation.prompt_template_id && (
                      <div>
                        <span>Template: {
                          promptTemplates.find(t => t.id === evaluation.prompt_template_id)?.name || 'Unknown Template'
                        }</span>
                      </div>
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

      {/* Evaluation Info Modal */}
      {showEvaluationInfoModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowEvaluationInfoModal(false)}
        >
          <div 
            style={{
              backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
              border: `1px solid ${theme.border}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: theme.text, fontSize: '18px', fontWeight: '600' }}>
                Evaluation Details
              </h2>
              <button
                onClick={() => setShowEvaluationInfoModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: theme.textSecondary,
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Evaluation Info */}
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '14px', fontWeight: '600' }}>
                  Evaluation
                </h3>
                <div style={{ backgroundColor: theme.bgSecondary, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Name:</span>{' '}
                    <span style={{ color: theme.text }}>{currentEvaluationName}</span>
                  </div>
                  <div>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>ID:</span>{' '}
                    <span style={{ color: theme.text, fontFamily: 'monospace', fontSize: '12px' }}>{currentEvaluationId}</span>
                  </div>
                </div>
              </div>

              {/* Conversation Info */}
              {currentConversation && (
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '14px', fontWeight: '600' }}>
                    Conversation
                  </h3>
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Name:</span>{' '}
                      <span style={{ color: theme.text }}>{currentConversation.name}</span>
                    </div>
                    <div>
                      <span style={{ color: theme.textSecondary, fontWeight: '500' }}>ID:</span>{' '}
                      <span style={{ color: theme.text, fontFamily: 'monospace', fontSize: '12px' }}>{currentConversation.id}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Prompt Template Info */}
              {currentPromptTemplateName && (
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '14px', fontWeight: '600' }}>
                    Cleaning Template
                  </h3>
                  <div style={{ backgroundColor: theme.bgSecondary, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ color: theme.text }}>{currentPromptTemplateName}</span>
                  </div>
                </div>
              )}

              {/* Function Template Info */}
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '14px', fontWeight: '600' }}>
                  Function Template
                </h3>
                <div style={{ backgroundColor: theme.bgSecondary, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <span style={{ color: theme.text }}>
                    {modalFunctionTemplateName || 'Loading...'}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '14px', fontWeight: '600' }}>
                  Statistics
                </h3>
                <div style={{ backgroundColor: theme.bgSecondary, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Total Turns:</span>{' '}
                    <span style={{ color: theme.text }}>{cleanedTurns.length}</span>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Cleaned Turns:</span>{' '}
                    <span style={{ color: theme.text }}>{cleanedTurns.filter(t => t.metadata.cleaning_applied).length}</span>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Function Calls:</span>{' '}
                    <span style={{ color: theme.text }}>{cleanedTurns.reduce((acc, t) => acc + (t.function_calls?.length || 0), 0)}</span>
                  </div>
                  <div>
                    <span style={{ color: theme.textSecondary, fontWeight: '500' }}>Total Cost:</span>{' '}
                    <span 
                      style={{ 
                        color: theme.text, 
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        borderBottom: '1px dotted rgba(150, 150, 150, 0.5)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        const totalCostBreakdown = cleanedTurns.reduce((acc, turn) => {
                          if (turn.cost_breakdown) {
                            acc.cleaning += turn.cost_breakdown.cleaning_cost_usd;
                            acc.function += turn.cost_breakdown.function_cost_usd;
                            acc.total += turn.cost_breakdown.total_cost_usd;
                          } else if (turn.cost_usd) {
                            acc.total += turn.cost_usd;
                          }
                          return acc;
                        }, { cleaning: 0, function: 0, total: 0 });
                        
                        const tooltip = document.createElement('div');
                        tooltip.style.cssText = `
                          position: absolute;
                          bottom: 100%;
                          left: 50%;
                          transform: translateX(-50%);
                          background: rgba(0, 0, 0, 0.9);
                          color: white;
                          padding: 8px 12px;
                          border-radius: 4px;
                          font-size: 12px;
                          white-space: pre-line;
                          z-index: 1000;
                          margin-bottom: 5px;
                          font-family: monospace;
                        `;
                        tooltip.textContent = `Cleaning: $${totalCostBreakdown.cleaning.toFixed(6)}\nFunction: $${totalCostBreakdown.function.toFixed(6)}\nTotal: $${totalCostBreakdown.total.toFixed(6)}`;
                        e.currentTarget.appendChild(tooltip);
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.querySelector('div');
                        if (tooltip) tooltip.remove();
                      }}
                    >
                      ${cleanedTurns.reduce((acc, turn) => {
                        if (turn.cost_breakdown) {
                          return acc + turn.cost_breakdown.total_cost_usd;
                        } else if (turn.cost_usd) {
                          return acc + turn.cost_usd;
                        }
                        return acc;
                      }, 0).toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Config Modal */}
      {showEvaluationConfigModal && evaluationConfigData && (
        <EvaluationConfigModal
          isOpen={showEvaluationConfigModal}
          onClose={() => setShowEvaluationConfigModal(false)}
          onConfirm={() => {
            setShowEvaluationConfigModal(false)
            startCleaning()
          }}
          config={evaluationConfigData}
          theme={getThemeColors()}
        />
      )}

      {/* Customer Modal */}
      {showCustomersModal && (
        <CustomerModal
          isOpen={showCustomersModal}
          onClose={() => setShowCustomersModal(false)}
          customers={customers}
          onAdd={handleAddCustomer}
          onEdit={handleEditCustomer}
          onDelete={handleDeleteCustomer}
          onSetAsDefault={handleSetDefaultCustomer}
          loading={loadingCustomers}
          theme={getThemeColors()}
        />
      )}
    </div>
  )
}