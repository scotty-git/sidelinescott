import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

// Monaco Editor for code editing
import Editor from '@monaco-editor/react'

// New components
import { TemplateLibraryModal } from '../components/TemplateLibraryModal'
import { ToastProvider, useTemplateToasts } from '../components/ToastNotification'
import { createTemplateValidator, formatValidationMessage } from '../utils/templateValidation'
import type { ValidationError, ValidationWarning } from '../utils/templateValidation'

interface PromptTemplate {
  id: string
  name: string
  template: string
  description?: string
  variables: string[]
  version: string
  created_at: string
  updated_at: string
}

interface PromptVariable {
  name: string
  value: any
  data_type: string
  description?: string
}

interface RenderedPrompt {
  template_id: string
  template_name: string
  raw_template: string
  rendered_prompt: string
  variables_used: PromptVariable[]
  token_count?: number
  created_at: number
}

interface TurnAnalysis {
  turn_id: string
  conversation_id: string
  speaker: string
  raw_text: string
  cleaned_text: string
  template_used: PromptTemplate
  rendered_prompt: RenderedPrompt
  processing_time_ms: number
  confidence_score: string
  corrections: any[]
}

function PromptEngineeringDashboardInner() {
  const [activeTab, setActiveTab] = useState<'inspector' | 'master' | 'versions' | 'ab-test' | 'analytics'>('master')
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<PromptTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Master Editor State
  const [editingTemplate, setEditingTemplate] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [previewVariables, setPreviewVariables] = useState({
    conversation_context: 'User: Hey there\nLumen: Hello! How can I help you today?',
    raw_text: 'So umm, like, I was thinking we could maybe, you know, try to...',
    cleaning_level: 'full',
    call_context: '',
    additional_context: ''
  })
  const [renderedPreview, setRenderedPreview] = useState<RenderedPrompt | null>(null)

  // Turn Inspector State
  const [selectedTurnId, setSelectedTurnId] = useState('')
  const [turnAnalysis, setTurnAnalysis] = useState<TurnAnalysis | null>(null)

  // New dual testing mode state
  const [dataSource, setDataSource] = useState<'test' | 'real' | 'saved'>('test')
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversationTurns, setConversationTurns] = useState<any[]>([])
  const [testingMode, setTestingMode] = useState<'single_turn' | 'full_conversation'>('single_turn')
  const [selectedTurnIndex, setSelectedTurnIndex] = useState(0)
  const [customVariable, setCustomVariable] = useState('')
  const [testConversations, setTestConversations] = useState<any[]>([])
  const [selectedTestConversationId, setSelectedTestConversationId] = useState('')
  const [conversationSimulationResult, setConversationSimulationResult] = useState<any>(null)

  // Template Library Modal State
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)

  // Smart Template Management State
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Validation State
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([])
  const [validator, setValidator] = useState<ReturnType<typeof createTemplateValidator> | null>(null)

  // Theme
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('prompt-dashboard-dark-mode')
    return saved ? JSON.parse(saved) : true
  })

  // Toast notifications
  const templateToasts = useTemplateToasts()

  const theme = {
    bg: darkMode ? '#1f2937' : '#ffffff',
    bgSecondary: darkMode ? '#374151' : '#f9fafb',
    bgTertiary: darkMode ? '#4b5563' : '#f3f4f6',
    text: darkMode ? '#f9fafb' : '#111827',
    textSecondary: darkMode ? '#d1d5db' : '#374151',
    textMuted: darkMode ? '#9ca3af' : '#6b7280',
    border: darkMode ? '#4b5563' : '#e5e7eb',
    accent: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Initialize validator when templates change
  useEffect(() => {
    const templateNames = templates.map(t => ({ id: t.id, name: t.name }))
    setValidator(createTemplateValidator(templateNames))
  }, [templates])

  useEffect(() => {
    if (dataSource === 'real') {
      loadConversations()
    } else if (dataSource === 'saved') {
      loadTestConversations()
    }
  }, [dataSource])

  useEffect(() => {
    if (selectedConversationId && dataSource === 'real') {
      loadConversationTurns(selectedConversationId)
    }
  }, [selectedConversationId, dataSource])

  useEffect(() => {
    localStorage.setItem('prompt-dashboard-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/v1/prompt-engineering/templates') as PromptTemplate[]
      console.log('✅ Templates loaded successfully:', response.length, 'templates')
      setTemplates(response)
      
      // Load the first template if available (or user can select one)
      if (response.length > 0) {
        const firstTemplate = response[0]
        setActiveTemplate(firstTemplate)
        setEditingTemplate(firstTemplate.template)
        setTemplateName(firstTemplate.name)
        setTemplateDescription(firstTemplate.description || '')
      }
      
      // Templates loaded successfully - don't show toast for this common operation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Load Templates', errorMessage)
      setError(`Failed to load templates: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Real-time validation function
  const validateCurrentTemplate = () => {
    if (!validator) return

    const validation = validator.validateTemplate(
      templateName,
      editingTemplate,
      templateDescription,
      activeTemplate?.id
    )
    
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
    
    return validation.isValid
  }

  // Helper function to extract variables from template
  const extractVariablesFromTemplate = (template: string): string[] => {
    const variableRegex = /{(\w+)}/g
    const variables: string[] = []
    let match
    
    while ((match = variableRegex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }
    
    return variables
  }

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      currentTemplateId ? (
        templates.find(t => t.id === currentTemplateId)?.name !== templateName ||
        templates.find(t => t.id === currentTemplateId)?.template !== editingTemplate ||
        templates.find(t => t.id === currentTemplateId)?.description !== templateDescription
      ) : (
        templateName.trim() !== '' || editingTemplate.trim() !== '' || templateDescription.trim() !== ''
      )
    )
  }, [templateName, editingTemplate, templateDescription, currentTemplateId, templates])

  // Template CRUD operations with validation
  const handleTemplateNameChange = (name: string) => {
    setTemplateName(name)
    if (validator) {
      const fieldValidation = validator.validateField('name', name, currentTemplateId || undefined)
      setValidationErrors(prev => [
        ...prev.filter(e => e.field !== 'name'),
        ...fieldValidation.errors
      ])
    }
  }

  const handleTemplateContentChange = (content: string) => {
    setEditingTemplate(content)
    if (validator) {
      const fieldValidation = validator.validateField('template', content)
      setValidationErrors(prev => [
        ...prev.filter(e => e.field !== 'template'),
        ...fieldValidation.errors
      ])
    }
  }

  const handleTemplateDescriptionChange = (description: string) => {
    setTemplateDescription(description)
    if (validator) {
      const fieldValidation = validator.validateField('description', description)
      setValidationWarnings(prev => [
        ...prev.filter(w => w.field !== 'description'),
        ...fieldValidation.warnings
      ])
    }
  }

  const renderPreview = async () => {
    if (!activeTemplate) return

    try {
      const response = await apiClient.post(`/api/v1/prompt-engineering/templates/${activeTemplate.id}/render`, {
        template_id: activeTemplate.id,
        variables: previewVariables
      }) as RenderedPrompt
      setRenderedPreview(response)
    } catch (err) {
      setError(`Failed to render preview: ${err}`)
    }
  }

  // Smart Save System - handles both create and update
  const handleSave = async () => {
    // Validate before saving
    const isValid = validateCurrentTemplate()
    if (!isValid) {
      const errorMessages = validationErrors.map(formatValidationMessage)
      templateToasts.showValidationError(errorMessages)
      return
    }

    // Check if template name is provided
    if (!templateName.trim()) {
      templateToasts.showValidationError(['Template name is required'])
      return
    }

    try {
      setLoading(true)
      
      if (currentTemplateId) {
        // UPDATE existing template
        await apiClient.put(`/api/v1/prompt-engineering/templates/${currentTemplateId}`, {
          name: templateName,
          template: editingTemplate,
          description: templateDescription
        })
        templateToasts.showSaveSuccess(`Updated "${templateName}"`)
      } else {
        // CREATE new template
        const detectedVariables = extractVariablesFromTemplate(editingTemplate)
        const response = await apiClient.post('/api/v1/prompt-engineering/templates', {
          name: templateName,
          template: editingTemplate,
          description: templateDescription || 'Custom prompt template',
          variables: detectedVariables
        }) as PromptTemplate
        
        // Set the new template as current
        setCurrentTemplateId(response.id)
        templateToasts.showSaveSuccess(`Created "${templateName}"`)
      }
      
      await loadTemplates()
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const action = currentTemplateId ? 'Update Template' : 'Create Template'
      templateToasts.showApiError(action, errorMessage)
      setError(`Failed to ${action.toLowerCase()}: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Save As - always creates new template
  const handleSaveAs = async () => {
    // Validate before saving
    const isValid = validateCurrentTemplate()
    if (!isValid) {
      const errorMessages = validationErrors.map(formatValidationMessage)
      templateToasts.showValidationError(errorMessages)
      return
    }

    // Prompt user for new name
    const newName = window.prompt('Enter name for the new template:', `${templateName} (Copy)`)
    if (!newName?.trim()) return

    try {
      setLoading(true)
      const detectedVariables = extractVariablesFromTemplate(editingTemplate)
      const response = await apiClient.post('/api/v1/prompt-engineering/templates', {
        name: newName,
        template: editingTemplate,
        description: templateDescription || 'Forked template',
        variables: detectedVariables
      }) as PromptTemplate
      
      // Switch to the new template
      setCurrentTemplateId(response.id)
      setTemplateName(newName)
      
      await loadTemplates()
      templateToasts.showSaveSuccess(`Created "${newName}" from "${templateName}"`)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Save As Template', errorMessage)
      setError(`Failed to create template: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // New Template - clears everything
  const handleNewTemplate = () => {
    setCurrentTemplateId(null)
    setTemplateName('')
    setEditingTemplate('')
    setTemplateDescription('')
    setValidationErrors([])
    setValidationWarnings([])
  }

  const createNewTemplate = async () => {
    try {
      setLoading(true)
      const newTemplateName = `New Template ${Date.now()}`
      await apiClient.post('/api/v1/prompt-engineering/templates', {
        name: newTemplateName,
        template: 'Your prompt template here with {raw_text}, {conversation_context}, and {cleaning_level}',
        description: 'New template description',
        variables: ['raw_text', 'conversation_context', 'cleaning_level']
      })
      
      await loadTemplates()
      templateToasts.showSaveSuccess(newTemplateName)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Create Template', errorMessage)
      setError(`Failed to create template: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Template Library Modal Handlers
  const handleEditTemplate = (template: PromptTemplate) => {
    setCurrentTemplateId(template.id)
    setActiveTemplate(template)
    setEditingTemplate(template.template)
    setTemplateName(template.name)
    setTemplateDescription(template.description || '')
    setActiveTab('master')
    setShowTemplateLibrary(false)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    try {
      await apiClient.delete(`/api/v1/prompt-engineering/templates/${templateId}`)
      await loadTemplates()
      templateToasts.showDeleteSuccess(template.name)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Delete Template', errorMessage)
    }
  }

  const handleDuplicateTemplate = async (template: PromptTemplate) => {
    try {
      const newName = `${template.name} (Copy)`
      await apiClient.post('/api/v1/prompt-engineering/templates', {
        name: newName,
        template: template.template,
        description: template.description,
        variables: template.variables
      })
      
      await loadTemplates()
      templateToasts.showDuplicateSuccess(template.name, newName)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Duplicate Template', errorMessage)
    }
  }

  const handleBulkAction = async (action: string, templateIds: string[]) => {
    try {
      if (action === 'delete') {
        // Delete all selected templates
        await Promise.all(templateIds.map(id => handleDeleteTemplate(id)))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Bulk Action', errorMessage)
    }
  }

  const analyzeTurn = async () => {
    if (!selectedTurnId) return

    try {
      setLoading(true)
      const response = await apiClient.get(`/api/v1/prompt-engineering/turns/${selectedTurnId}/prompt-analysis`) as TurnAnalysis
      setTurnAnalysis(response)
    } catch (err) {
      setError(`Failed to analyze turn: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const loadConversations = async () => {
    try {
      const response = await apiClient.get('/api/v1/conversations') as { conversations: any[] }
      setConversations(response.conversations || [])
    } catch (err) {
      setError(`Failed to load conversations: ${err}`)
    }
  }

  const loadConversationTurns = async (conversationId: string) => {
    try {
      const response = await apiClient.get(`/api/v1/conversations/${conversationId}/turns`) as { turns: any[] }
      setConversationTurns(response.turns || [])
    } catch (err) {
      setError(`Failed to load conversation turns: ${err}`)
    }
  }

  const loadTestConversations = async () => {
    try {
      const response = await apiClient.get('/api/v1/prompt-engineering/test-conversations') as any[]
      setTestConversations(response || [])
    } catch (err) {
      setError(`Failed to load test conversations: ${err}`)
    }
  }

  const simulateWithConversation = async () => {
    if (!activeTemplate || !selectedConversationId) return

    try {
      setLoading(true)
      const payload = {
        template_id: activeTemplate.id,
        conversation_id: selectedConversationId,
        testing_mode: testingMode,
        turn_index: testingMode === 'single_turn' ? selectedTurnIndex : undefined,
        custom_variable: customVariable
      }

      const response = await apiClient.post(`/api/v1/prompt-engineering/templates/${activeTemplate.id}/simulate/conversation`, payload)
      setConversationSimulationResult(response)
    } catch (err) {
      setError(`Failed to simulate with conversation: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const simulatePrompt = async () => {
    if (!activeTemplate) return

    try {
      const response = await apiClient.post(`/api/v1/prompt-engineering/templates/${activeTemplate.id}/simulate`, {
        template_id: activeTemplate.id,
        sample_raw_text: previewVariables.raw_text,
        sample_speaker: 'User',
        sample_context: [
          { speaker: 'User', cleaned_text: 'Hey there' },
          { speaker: 'Lumen', cleaned_text: 'Hello! How can I help you today?' }
        ],
        cleaning_level: previewVariables.cleaning_level
      })
      
      console.log('Simulation result:', response)
      alert('Simulation complete! Check console for details.')
    } catch (err) {
      setError(`Failed to simulate prompt: ${err}`)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: theme.bg, 
      color: theme.text,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: theme.bgSecondary, 
        borderBottom: `1px solid ${theme.border}`,
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.bgTertiary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Back to Main Dashboard"
            >
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                🔧 Prompt Engineering Dashboard
              </h1>
              <p style={{ margin: '4px 0 0 0', color: theme.textMuted }}>
                Full visibility and control over AI cleaning prompts
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowTemplateLibrary(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📚 Template Library ({templates.length})
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.bgTertiary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                cursor: 'pointer'
              }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>
              Active: {activeTemplate?.name || 'None'}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        backgroundColor: theme.bgSecondary, 
        borderBottom: `1px solid ${theme.border}`,
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { id: 'master', label: '⚙️ Master Editor', desc: 'Edit core prompt template' },
            { id: 'inspector', label: '🔍 Turn Inspector', desc: 'Analyze individual prompts' },
            { id: 'versions', label: '📋 Version Manager', desc: 'Save and compare versions' },
            { id: 'ab-test', label: '🧪 A/B Testing', desc: 'Compare prompt performance' },
            { id: 'analytics', label: '📊 Analytics', desc: 'Performance insights' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 20px',
                backgroundColor: activeTab === tab.id ? theme.bg : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${theme.accent}` : '2px solid transparent',
                color: activeTab === tab.id ? theme.text : theme.textMuted,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                transition: 'all 0.15s ease'
              }}
              title={tab.desc}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: theme.error + '20',
          color: theme.error,
          padding: '12px 24px',
          borderBottom: `1px solid ${theme.border}`
        }}>
          ⚠️ {error}
          <button 
            onClick={() => setError(null)}
            style={{ 
              marginLeft: '12px', 
              background: 'none', 
              border: 'none', 
              color: theme.error, 
              cursor: 'pointer' 
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Master Editor Tab */}
        {activeTab === 'master' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: '800px' }}>
            {/* Left Panel - Template Editor */}
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ 
                padding: '16px',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ margin: 0 }}>
                  Prompt Template Editor
                  {currentTemplateId && (
                    <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'normal', marginLeft: '8px' }}>
                      (Editing: {templateName})
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleNewTemplate}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: theme.bgTertiary,
                      color: theme.text,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✨ New
                  </button>
                  <button
                    onClick={renderPreview}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: theme.accent,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🔄 Preview
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || !hasUnsavedChanges}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: hasUnsavedChanges ? theme.success : theme.bgTertiary,
                      color: hasUnsavedChanges ? 'white' : theme.textMuted,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading || !hasUnsavedChanges ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {currentTemplateId ? '💾 Save' : '✅ Create'}
                  </button>
                  {currentTemplateId && (
                    <button
                      onClick={handleSaveAs}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: theme.warning,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      📋 Save As
                    </button>
                  )}
                </div>
              </div>

              {/* Template Metadata */}
              <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => handleTemplateNameChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => handleTemplateDescriptionChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Monaco Editor */}
              <div style={{ flex: 1, minHeight: '400px' }}>
                <Editor
                  height="100%"
                  defaultLanguage="text"
                  value={editingTemplate}
                  onChange={(value) => handleTemplateContentChange(value || '')}
                  theme={darkMode ? 'vs-dark' : 'light'}
                  options={{
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    lineNumbers: 'on',
                    folding: true
                  }}
                />
              </div>

              {/* Validation Feedback */}
              {(validationErrors.length > 0 || validationWarnings.length > 0) && (
                <div style={{ 
                  padding: '12px 16px',
                  borderTop: `1px solid ${theme.border}`,
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {validationErrors.map((error, index) => (
                    <div key={`error-${index}`} style={{
                      color: theme.error,
                      fontSize: '11px',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px'
                    }}>
                      <span>❌</span>
                      <span>{formatValidationMessage(error)}</span>
                    </div>
                  ))}
                  {validationWarnings.map((warning, index) => (
                    <div key={`warning-${index}`} style={{
                      color: theme.warning,
                      fontSize: '11px',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px'
                    }}>
                      <span>⚠️</span>
                      <span>{formatValidationMessage(warning)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Variables Detection */}
              <div style={{ 
                padding: '12px 16px',
                borderTop: `1px solid ${theme.border}`,
                fontSize: '12px',
                color: theme.textMuted
              }}>
                Variables detected: {activeTemplate?.variables.join(', ') || 'None'}
              </div>
            </div>

            {/* Right Panel - Preview & Variables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Data Source Selection */}
              <div style={{ 
                backgroundColor: theme.bgSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                padding: '16px'
              }}>
                <h4 style={{ margin: '0 0 12px 0' }}>Testing Data Source</h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {(['test', 'real', 'saved'] as const).map((source) => (
                    <button
                      key={source}
                      onClick={() => setDataSource(source)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: dataSource === source ? theme.accent : theme.bgTertiary,
                        color: dataSource === source ? 'white' : theme.text,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: dataSource === source ? '600' : '400'
                      }}
                    >
                      {source === 'test' ? 'Test Data' : source === 'real' ? 'Real Conversation' : 'Saved Test'}
                    </button>
                  ))}
                </div>

                {dataSource === 'test' && (
                  <>
                    <div style={{ 
                      backgroundColor: theme.bgTertiary, 
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                  padding: '8px',
                  marginBottom: '16px',
                  fontSize: '11px',
                  color: theme.textMuted
                }}>
                  <strong style={{ color: theme.text }}>5-Variable System:</strong><br/>
                  <span style={{ color: theme.error }}>Required:</span> raw_text, conversation_context, cleaning_level<br/>
                  <span style={{ color: theme.warning }}>Optional:</span> call_context, additional_context<br/>
                  <em>Empty variables appear as blank in prompt (no hidden defaults)</em>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    conversation_context <span style={{ color: theme.error }}>(required)</span>
                  </label>
                  <textarea
                    value={previewVariables.conversation_context}
                    onChange={(e) => setPreviewVariables({...previewVariables, conversation_context: e.target.value})}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    raw_text <span style={{ color: theme.error }}>(required)</span>
                  </label>
                  <textarea
                    value={previewVariables.raw_text}
                    onChange={(e) => setPreviewVariables({...previewVariables, raw_text: e.target.value})}
                    style={{
                      width: '100%',
                      height: '60px',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    cleaning_level <span style={{ color: theme.error }}>(required)</span>
                  </label>
                  <select
                    value={previewVariables.cleaning_level}
                    onChange={(e) => setPreviewVariables({...previewVariables, cleaning_level: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '14px'
                    }}
                  >
                    <option value="light">light</option>
                    <option value="full">full</option>
                    <option value="none">none</option>
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    call_context <span style={{ color: theme.warning }}>(optional)</span>
                  </label>
                  <textarea
                    value={previewVariables.call_context}
                    onChange={(e) => setPreviewVariables({...previewVariables, call_context: e.target.value})}
                    placeholder="Business context from prequalification flow..."
                    style={{
                      width: '100%',
                      height: '60px',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    additional_context <span style={{ color: theme.warning }}>(optional)</span>
                  </label>
                  <textarea
                    value={previewVariables.additional_context}
                    onChange={(e) => setPreviewVariables({...previewVariables, additional_context: e.target.value})}
                    placeholder="User-defined additional context for cleaning..."
                    style={{
                      width: '100%',
                      height: '60px',
                      padding: '8px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      color: theme.text,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                    <button
                      onClick={simulatePrompt}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: theme.warning,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      🧪 Test Prompt (Simulation)
                    </button>
                  </>
                )}

                {dataSource === 'real' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                        Select Conversation
                      </label>
                      <select
                        value={selectedConversationId}
                        onChange={(e) => setSelectedConversationId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Select a conversation...</option>
                        {conversations.map((conv) => (
                          <option key={conv.id} value={conv.id}>
                            {conv.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedConversationId && (
                      <>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                            Testing Mode
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => setTestingMode('single_turn')}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: testingMode === 'single_turn' ? theme.accent : theme.bgTertiary,
                                color: testingMode === 'single_turn' ? 'white' : theme.text,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Single Turn
                            </button>
                            <button
                              onClick={() => setTestingMode('full_conversation')}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: testingMode === 'full_conversation' ? theme.accent : theme.bgTertiary,
                                color: testingMode === 'full_conversation' ? 'white' : theme.text,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Full Conversation
                            </button>
                          </div>
                        </div>

                        {testingMode === 'single_turn' && conversationTurns.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                              Select Turn (Turn {selectedTurnIndex + 1} of {conversationTurns.length})
                            </label>
                            <input
                              type="range"
                              min="0"
                              max={conversationTurns.length - 1}
                              value={selectedTurnIndex}
                              onChange={(e) => setSelectedTurnIndex(parseInt(e.target.value))}
                              style={{ width: '100%', marginBottom: '8px' }}
                            />
                            <div style={{
                              backgroundColor: theme.bgTertiary,
                              padding: '8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}>
                              <strong>{conversationTurns[selectedTurnIndex]?.speaker}:</strong> {conversationTurns[selectedTurnIndex]?.raw_text?.substring(0, 100)}...
                            </div>
                          </div>
                        )}

                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                            Custom Variable (Optional)
                          </label>
                          <input
                            type="text"
                            value={customVariable}
                            onChange={(e) => setCustomVariable(e.target.value)}
                            placeholder="Add custom variable for testing..."
                            style={{
                              width: '100%',
                              padding: '8px',
                              backgroundColor: theme.bg,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '4px',
                              color: theme.text,
                              fontSize: '12px'
                            }}
                          />
                        </div>

                        {conversationTurns.length > 0 && (
                          <div style={{
                            backgroundColor: theme.bgTertiary,
                            padding: '12px',
                            borderRadius: '4px',
                            marginBottom: '16px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            <strong>Conversation Preview:</strong><br/>
                            {conversationTurns.slice(0, 10).map((turn, i) => (
                              <div key={i} style={{ marginBottom: '4px' }}>
                                <span style={{ color: theme.accent }}>{turn.speaker}:</span> {turn.raw_text?.substring(0, 80)}...
                              </div>
                            ))}
                            {conversationTurns.length > 10 && <div>...and {conversationTurns.length - 10} more turns</div>}
                          </div>
                        )}

                        <button
                          onClick={simulateWithConversation}
                          disabled={loading}
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: theme.accent,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            opacity: loading ? 0.6 : 1
                          }}
                        >
                          🚀 Test with {testingMode === 'single_turn' ? 'Single Turn' : 'Full Conversation'}
                        </button>
                      </>
                    )}
                  </>
                )}

                {dataSource === 'saved' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                        Select Saved Test
                      </label>
                      <select
                        value={selectedTestConversationId}
                        onChange={(e) => setSelectedTestConversationId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Select a saved test...</option>
                        {testConversations.map((test) => (
                          <option key={test.id} value={test.id}>
                            {test.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {testConversations.length === 0 && (
                      <div style={{
                        textAlign: 'center',
                        color: theme.textMuted,
                        fontSize: '12px',
                        padding: '20px'
                      }}>
                        No saved test conversations yet.<br/>
                        Create one by switching to "Test Data" mode and saving your configuration.
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Results Display */}
              {conversationSimulationResult && dataSource === 'real' && (
                <div style={{ 
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  flex: 1
                }}>
                  <div style={{ 
                    padding: '16px',
                    borderBottom: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <h4 style={{ margin: 0 }}>
                      {conversationSimulationResult.mode === 'single_turn' ? 'Single Turn Results' : 'Full Conversation Results'}
                    </h4>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      {conversationSimulationResult.mode === 'full_conversation' 
                        ? `${conversationSimulationResult.summary?.total_turns_tested} turns tested`
                        : `~${conversationSimulationResult.token_count} tokens`
                      }
                    </div>
                  </div>
                  <div style={{ 
                    padding: '16px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    {conversationSimulationResult.mode === 'single_turn' ? (
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        backgroundColor: theme.bg,
                        padding: '12px',
                        borderRadius: '4px'
                      }}>
                        {conversationSimulationResult.rendered_prompt}
                      </div>
                    ) : (
                      <div>
                        <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                          <strong>Summary:</strong> {conversationSimulationResult.summary?.successful_renders}/{conversationSimulationResult.summary?.total_turns_tested} successful renders
                        </div>
                        {conversationSimulationResult.results?.slice(0, 5).map((result: any, i: number) => (
                          <div key={i} style={{
                            marginBottom: '12px',
                            padding: '8px',
                            backgroundColor: theme.bgTertiary,
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            <strong>Turn {result.turn_index + 1} ({result.speaker}):</strong><br/>
                            {result.raw_text?.substring(0, 100)}...<br/>
                            <span style={{ color: result.success ? theme.success : theme.error }}>
                              {result.success ? '✓ Rendered successfully' : '✗ Failed to render'}
                            </span>
                          </div>
                        ))}
                        {conversationSimulationResult.results?.length > 5 && (
                          <div style={{ fontSize: '11px', color: theme.textMuted }}>
                            ...and {conversationSimulationResult.results.length - 5} more results
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rendered Preview */}
              {renderedPreview && (
                <div style={{ 
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  flex: 1
                }}>
                  <div style={{ 
                    padding: '16px',
                    borderBottom: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <h4 style={{ margin: 0 }}>Final Prompt Preview</h4>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      ~{renderedPreview.token_count} tokens
                    </div>
                  </div>
                  <div style={{ 
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: theme.bg,
                    margin: '0',
                    borderRadius: '0 0 8px 8px'
                  }}>
                    {renderedPreview.rendered_prompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Turn Inspector Tab */}
        {activeTab === 'inspector' && (
          <div style={{ maxWidth: '800px' }}>
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              padding: '24px'
            }}>
              <h3 style={{ margin: '0 0 20px 0' }}>🔍 Turn Inspector</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px' }}>
                  Turn ID to Analyze
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    value={selectedTurnId}
                    onChange={(e) => setSelectedTurnId(e.target.value)}
                    placeholder="Enter turn UUID..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.text,
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={analyzeTurn}
                    disabled={!selectedTurnId || loading}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: theme.accent,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: selectedTurnId && !loading ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      opacity: selectedTurnId && !loading ? 1 : 0.6
                    }}
                  >
                    {loading ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </div>

              {turnAnalysis && (
                <div style={{ 
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0' }}>Turn Analysis Results</h4>
                  
                  <div style={{ marginBottom: '16px', fontSize: '14px' }}>
                    <strong>Speaker:</strong> {turnAnalysis.speaker} | 
                    <strong> Processing Time:</strong> {turnAnalysis.processing_time_ms}ms | 
                    <strong> Confidence:</strong> {turnAnalysis.confidence_score}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <strong>Raw Text:</strong>
                    <div style={{ 
                      backgroundColor: theme.bgTertiary,
                      padding: '12px',
                      borderRadius: '4px',
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      {turnAnalysis.raw_text}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <strong>Cleaned Text:</strong>
                    <div style={{ 
                      backgroundColor: theme.bgTertiary,
                      padding: '12px',
                      borderRadius: '4px',
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      {turnAnalysis.cleaned_text}
                    </div>
                  </div>

                  <div>
                    <strong>Full Prompt Used:</strong>
                    <div style={{ 
                      backgroundColor: theme.bgTertiary,
                      padding: '12px',
                      borderRadius: '4px',
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {turnAnalysis.rendered_prompt.rendered_prompt}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Version Manager Tab */}
        {activeTab === 'versions' && (
          <div>
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>📋 Version Manager</h3>
                <button
                  onClick={createNewTemplate}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: theme.success,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ➕ New Template
                </button>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {templates.map(template => (
                  <div
                    key={template.id}
                    style={{
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: '12px', color: theme.textMuted }}>
                        v{template.version} | {template.variables.length} variables | 
                        Updated {new Date(template.updated_at).toLocaleDateString()}
                      </div>
                      {template.description && (
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                          {template.description}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setActiveTemplate(template)
                          setEditingTemplate(template.template)
                          setTemplateName(template.name)
                          setTemplateDescription(template.description || '')
                          setActiveTab('master')
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: theme.bgTertiary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* A/B Testing Tab */}
        {activeTab === 'ab-test' && (
          <div style={{ 
            backgroundColor: theme.bgSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>🧪 A/B Testing</h3>
            <p style={{ color: theme.textMuted, marginBottom: '24px' }}>
              Compare prompt performance with statistical significance testing
            </p>
            <div style={{ 
              padding: '40px',
              backgroundColor: theme.bg,
              borderRadius: '8px',
              border: `2px dashed ${theme.border}`
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Coming Soon</div>
              <div style={{ color: theme.textMuted }}>
                A/B testing framework with automatic traffic splitting and statistical analysis
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div style={{ 
            backgroundColor: theme.bgSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>📊 Analytics</h3>
            <p style={{ color: theme.textMuted, marginBottom: '24px' }}>
              Performance insights and prompt optimization recommendations
            </p>
            <div style={{ 
              padding: '40px',
              backgroundColor: theme.bg,
              borderRadius: '8px',
              border: `2px dashed ${theme.border}`
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Coming Soon</div>
              <div style={{ color: theme.textMuted }}>
                Advanced analytics including token usage, context utilization, and performance trends
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Template Library Modal */}
      <TemplateLibraryModal
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        templates={templates}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onDuplicate={handleDuplicateTemplate}
        onBulkAction={handleBulkAction}
        loading={loading}
        theme={theme}
      />
    </div>
  )
}

// Wrap the main component with ToastProvider
export function PromptEngineeringDashboard() {
  return (
    <ToastProvider>
      <PromptEngineeringDashboardInner />
    </ToastProvider>
  )
}