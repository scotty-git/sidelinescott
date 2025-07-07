import React, { useState, useRef } from 'react'
import { Button } from '../components/Button'
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
      from: string
      to: string
      reason: string
    }>
    context_detected: string
    processing_time_ms: number
    ai_model_used: string
  }
  created_at: string
}

interface ProcessingStats {
  total_turns: number
  user_turns: number
  lumen_turns: number
  turns_with_noise: number
  turns_with_foreign_text: number
  avg_turn_length_chars: number
}

export function TranscriptCleanerV2() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'parse' | 'clean' | 'export'>('upload')
  const [rawTranscript, setRawTranscript] = useState('')
  const [parsedTurns, setParsedTurns] = useState<ParsedTurn[]>([])
  const [cleanedTurns, setCleanedTurns] = useState<CleanedTurn[]>([])
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setRawTranscript(content)
        setCurrentStep('parse')
      }
      reader.readAsText(file)
    }
  }

  const loadExampleScript = async () => {
    try {
      const response = await fetch('/examplescripts/examplescript2')
      const content = await response.text()
      setRawTranscript(content)
      setCurrentStep('parse')
    } catch (error) {
      console.error('Failed to load example script:', error)
    }
  }

  const parseTranscript = async () => {
    if (!rawTranscript.trim()) return

    try {
      setIsProcessing(true)
      const response = await apiClient.post('/api/v1/conversations/parse-transcript', {
        raw_transcript: rawTranscript
      })

      setParsedTurns(response.parsed_turns)
      setProcessingStats(response.stats)
      setCurrentStep('clean')
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
      const convResponse = await apiClient.post('/api/v1/conversations', {
        name: `Transcript Cleaning ${new Date().toLocaleString()}`,
        description: 'Automated transcript cleaning session'
      })
      
      const newConversationId = convResponse.conversation.id
      setConversationId(newConversationId)
      
      // Process turns sequentially
      const cleaned: CleanedTurn[] = []
      
      for (let i = 0; i < parsedTurns.length; i++) {
        const turn = parsedTurns[i]
        setCurrentTurnIndex(i)
        
        try {
          const cleanResponse = await apiClient.post(`/api/v1/conversations/${newConversationId}/turns`, {
            speaker: turn.speaker,
            raw_text: turn.raw_text
          })
          
          cleaned.push(cleanResponse.turn)
          setCleanedTurns([...cleaned])
        } catch (turnError) {
          console.error(`Turn ${i + 1} failed:`, turnError)
        }
      }
      
      setCurrentStep('export')
    } catch (error) {
      console.error('Cleaning error:', error)
    } finally {
      setIsProcessing(false)
      setCurrentTurnIndex(0)
    }
  }

  const exportCleaned = () => {
    if (cleanedTurns.length === 0) return

    const exportText = cleanedTurns
      .map(turn => `${turn.speaker}:\n${turn.cleaned_text}\n`)
      .join('\n')

    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cleaned-transcript-${new Date().toISOString().slice(0, 19)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetWorkflow = () => {
    setCurrentStep('upload')
    setRawTranscript('')
    setParsedTurns([])
    setCleanedTurns([])
    setProcessingStats(null)
    setConversationId(null)
    setIsProcessing(false)
    setCurrentTurnIndex(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🎯 Lumen Transcript Cleaner
              </h1>
              <p className="text-gray-600 mt-1">
                AI-powered conversation cleaning with Gemini 2.5 Flash-Lite
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>
              <Button onClick={resetWorkflow} variant="secondary">
                Start Over
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: 'upload', label: 'Upload', icon: '📁' },
              { key: 'parse', label: 'Parse', icon: '🔍' },
              { key: 'clean', label: 'Clean', icon: '🤖' },
              { key: 'export', label: 'Export', icon: '📥' }
            ].map((step, index) => {
              const isActive = currentStep === step.key
              const isCompleted = ['upload', 'parse', 'clean', 'export'].indexOf(currentStep) > index
              
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-full text-lg font-medium
                    ${isActive ? 'bg-blue-600 text-white' : 
                      isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
                  `}>
                    {step.icon}
                  </div>
                  <div className="ml-3">
                    <div className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {step.label}
                    </div>
                  </div>
                  {index < 3 && (
                    <div className={`w-16 h-1 mx-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Upload Your Transcript
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Upload a conversation transcript file or try our example to see AI cleaning in action
                  </p>
                  
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4"
                    >
                      📁 Upload Transcript File
                    </Button>
                    
                    <div className="text-gray-400">or</div>
                    
                    <Button 
                      onClick={loadExampleScript}
                      variant="secondary"
                      className="text-lg px-8 py-4"
                    >
                      📝 Try Example Conversation
                    </Button>
                  </div>
                  
                  <div className="mt-8 text-sm text-gray-500">
                    <p>Supports .txt and .md files with conversation transcripts</p>
                    <p>Example contains real conversation with noise, foreign text, and artifacts</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parse Step */}
          {currentStep === 'parse' && (
            <>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Raw Transcript</h3>
                  <textarea
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    placeholder="Your transcript will appear here..."
                    className="w-full h-96 p-4 border rounded-lg font-mono text-sm resize-none"
                    readOnly={!showAdvanced}
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    {rawTranscript.length.toLocaleString()} characters
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Parse Transcript</h3>
                  <p className="text-gray-600 mb-4">
                    Extract individual conversation turns and detect speech artifacts
                  </p>
                  <Button 
                    onClick={parseTranscript}
                    disabled={!rawTranscript.trim() || isProcessing}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {isProcessing ? '🔄 Parsing...' : '🔍 Parse Transcript'}
                  </Button>
                </div>
                
                {processingStats && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h4 className="font-semibold mb-3">Analysis Results</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total turns:</span>
                        <span className="font-medium">{processingStats.total_turns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>User turns:</span>
                        <span className="font-medium">{processingStats.user_turns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AI turns:</span>
                        <span className="font-medium">{processingStats.lumen_turns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>With noise:</span>
                        <span className="font-medium text-amber-600">{processingStats.turns_with_noise}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Foreign text:</span>
                        <span className="font-medium text-amber-600">{processingStats.turns_with_foreign_text}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Clean Step */}
          {currentStep === 'clean' && (
            <>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Conversation Turns</h3>
                  <div className="space-y-4 h-96 overflow-y-auto">
                    {parsedTurns.map((turn, index) => (
                      <div key={index} className="border-l-4 border-gray-200 pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${
                            turn.speaker === 'User' ? 'text-green-600' : 'text-blue-600'
                          }`}>
                            {turn.speaker === 'User' ? '👤' : '🤖'} {turn.speaker}
                          </span>
                          {turn.has_noise && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Noise
                            </span>
                          )}
                          {turn.has_foreign_text && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Foreign
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{turn.raw_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">AI Cleaning</h3>
                  <p className="text-gray-600 mb-4">
                    Process each turn with Gemini 2.5 Flash-Lite for intelligent cleaning
                  </p>
                  <Button 
                    onClick={startCleaning}
                    disabled={parsedTurns.length === 0 || isProcessing}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? '🔄 Processing...' : '🤖 Start AI Cleaning'}
                  </Button>
                  
                  {isProcessing && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">
                          Processing turn {currentTurnIndex + 1} of {parsedTurns.length}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((currentTurnIndex + 1) / parsedTurns.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Export Step */}
          {currentStep === 'export' && (
            <>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Cleaned Conversation</h3>
                  <div className="space-y-4 h-96 overflow-y-auto">
                    {cleanedTurns.map((turn, index) => (
                      <div key={turn.turn_id} className="border-l-4 border-green-200 pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${
                            turn.speaker === 'User' ? 'text-green-600' : 'text-blue-600'
                          }`}>
                            {turn.speaker === 'User' ? '👤' : '🤖'} {turn.speaker}
                          </span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {turn.metadata.confidence_score}
                          </span>
                          {turn.metadata.cleaning_applied && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Cleaned
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{turn.cleaned_text}</p>
                        {showAdvanced && turn.metadata.corrections.length > 0 && (
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer">
                              {turn.metadata.corrections.length} corrections made
                            </summary>
                            <div className="mt-1 pl-2 space-y-1">
                              {turn.metadata.corrections.map((correction, i) => (
                                <div key={i}>
                                  "{correction.from}" → "{correction.to}"
                                  <span className="text-gray-400 ml-1">({correction.reason})</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold mb-4">Export Results</h3>
                  <p className="text-gray-600 mb-4">
                    Download your cleaned conversation transcript
                  </p>
                  <Button 
                    onClick={exportCleaned}
                    disabled={cleanedTurns.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    📥 Download Cleaned Transcript
                  </Button>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h4 className="font-semibold mb-3">Processing Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total turns processed:</span>
                      <span className="font-medium">{cleanedTurns.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Turns cleaned:</span>
                      <span className="font-medium text-green-600">
                        {cleanedTurns.filter(t => t.metadata.cleaning_applied).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>AI model used:</span>
                      <span className="font-medium text-xs">Gemini 2.5 Flash-Lite</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}