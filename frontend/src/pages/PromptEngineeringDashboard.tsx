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
  is_default: boolean
  created_at: string
  updated_at: string
}

interface FunctionPromptTemplate {
  id: string
  name: string
  template: string
  description?: string
  variables: string[]
  version: string
  is_default: boolean
  created_at: string
  updated_at: string
  custom_function_descriptions?: Record<string, string>
}

interface PromptVariable {
  name: string
  value: string | number | boolean | object
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


function PromptEngineeringDashboardInner() {
  const [activeTab, setActiveTab] = useState<'cleaner' | 'function'>('cleaner')
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
    customer_profile: '',
    additional_context: ''
  })
  const [renderedPreview] = useState<RenderedPrompt | null>(null)

  // Turn Inspector State (unused - keeping for future functionality)
  // const [selectedTurnId, setSelectedTurnId] = useState('')
  // const [turnAnalysis, setTurnAnalysis] = useState<TurnAnalysis | null>(null)

  // New dual testing mode state
  const [dataSource, setDataSource] = useState<'test' | 'real' | 'saved'>('test')
  const [conversations, setConversations] = useState<{id: string; name: string; created_at: string}[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversationTurns, setConversationTurns] = useState<{id: string; speaker: string; raw_text: string; cleaned_text: string}[]>([])
  const [testingMode, setTestingMode] = useState<'single_turn' | 'full_conversation'>('single_turn')
  const [selectedTurnIndex, setSelectedTurnIndex] = useState(0)
  const [customVariable, setCustomVariable] = useState('')
  const [testConversations, setTestConversations] = useState<{id: string; name: string; description: string; variables: object}[]>([])
  const [selectedTestConversationId, setSelectedTestConversationId] = useState('')
  const [conversationSimulationResult, setConversationSimulationResult] = useState<{
    mode: string; 
    results: Array<{
      turn_index: number;
      speaker: string;
      raw_text: string;
      success: boolean;
      cleaned_text?: string;
      context_turns_used?: number;
      rendered_prompt?: string;
      token_count?: number;
      error?: string;
    }>;
    summary?: {
      successful_renders: number;
      total_turns_tested: number;
    };
    token_count?: number;
    rendered_prompt?: string;
  } | null>(null)

  // Template Library Modal State
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)

  // Smart Template Management State
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Validation State
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([])
  const [validator, setValidator] = useState<ReturnType<typeof createTemplateValidator> | null>(null)
  const [validationTimeoutId, setValidationTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Theme
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('prompt-dashboard-dark-mode')
    return saved ? JSON.parse(saved) : true
  })

  // Toast notifications
  const templateToasts = useTemplateToasts()
  
  // Tooltip state
  const [hoveredVariable, setHoveredVariable] = useState<string | null>(null)
  
  // Monaco editor ref for drag and drop
  const [monacoEditor, setMonacoEditor] = useState<{ getPosition: () => any; executeEdits: (source: string, operations: any[]) => void; setPosition: (position: any) => void; focus: () => void } | null>(null)
  
  // Function prompt state
  const [functionPromptName, setFunctionPromptName] = useState('')
  const [functionPromptDescription, setFunctionPromptDescription] = useState('')
  const [functionPromptContent, setFunctionPromptContent] = useState('')
  
  // Function prompt validation state
  const [functionValidationErrors, setFunctionValidationErrors] = useState<ValidationError[]>([])
  const [functionValidationWarnings, setFunctionValidationWarnings] = useState<ValidationWarning[]>([])
  const [functionValidationTimeoutId, setFunctionValidationTimeoutId] = useState<NodeJS.Timeout | null>(null)
  
  // Function prompt template state
  const [functionTemplates, setFunctionTemplates] = useState<FunctionPromptTemplate[]>([])
  const [currentFunctionTemplateId, setCurrentFunctionTemplateId] = useState<string | null>(null)
  const [customFunctionDescriptions, setCustomFunctionDescriptions] = useState<Record<string, string>>({})
  const [hasFunctionUnsavedChanges, setHasFunctionUnsavedChanges] = useState(false)

  // Available functions from the function registry - exact definitions
  const AVAILABLE_FUNCTIONS = [
    { 
      name: 'update_profile_field', 
      defaultDescription: 'Updates a single, specific field in the prospect\'s company or contact profile. Use this ONLY when the user provides a direct correction or addition to a known fact about them.' 
    },
    { 
      name: 'log_metric', 
      defaultDescription: 'Logs a specific quantitative metric about the business. Use this when the user states a number related to their operations.' 
    },
    { 
      name: 'record_business_insight', 
      defaultDescription: 'Records a key qualitative insight, problem, goal, or motivation shared by the user. Use this to capture the \'why\' behind their interest or the challenges they face.' 
    },
    { 
      name: 'log_marketing_channels', 
      defaultDescription: 'Logs the marketing or lead generation channels the user mentions.' 
    },
    { 
      name: 'initiate_demo_creation', 
      defaultDescription: 'Call this ONLY when the user gives explicit, positive, and unambiguous consent to create the demo, such as \'Yes, I\'m ready\' or \'Let\'s do it\'.' 
    }
  ]

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
    loadFunctionTemplates()
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

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutId) {
        clearTimeout(validationTimeoutId)
      }
      if (functionValidationTimeoutId) {
        clearTimeout(functionValidationTimeoutId)
      }
    }
  }, [validationTimeoutId, functionValidationTimeoutId])

  // Run initial validation on page load for function prompt
  useEffect(() => {
    // Run validation immediately on page load to show initial errors
    debouncedFunctionValidation(functionPromptName, functionPromptContent, functionPromptDescription)
  }, []) // Empty dependency array means this runs once on mount

  // Load appropriate templates when tab changes
  useEffect(() => {
    if (activeTab === 'cleaner') {
      // Load cleaner template into form if available
      if (templates.length > 0 && !activeTemplate) {
        const firstTemplate = templates[0]
        setActiveTemplate(firstTemplate)
        setCurrentTemplateId(firstTemplate.id) // Set current template ID for edit mode
        setEditingTemplate(firstTemplate.template)
        setTemplateName(firstTemplate.name)
        setTemplateDescription(firstTemplate.description || '')
      }
    } else if (activeTab === 'function') {
      // Load function template into form if available
      if (functionTemplates.length > 0 && !currentFunctionTemplateId) {
        const firstTemplate = functionTemplates[0]
        setCurrentFunctionTemplateId(firstTemplate.id)
        setFunctionPromptName(firstTemplate.name)
        setFunctionPromptDescription(firstTemplate.description || '')
        setFunctionPromptContent(firstTemplate.template)
        
        // Load function descriptions with defaults if empty
        const loadedDescriptions = firstTemplate.custom_function_descriptions || {}
        const descriptionsWithDefaults = { ...loadedDescriptions }
        
        // Fill in any missing function descriptions with defaults
        AVAILABLE_FUNCTIONS.forEach(func => {
          if (!descriptionsWithDefaults[func.name]) {
            descriptionsWithDefaults[func.name] = func.defaultDescription
          }
        })
        
        setCustomFunctionDescriptions(descriptionsWithDefaults)
        
        // Clear validation errors when loading existing template
        setFunctionValidationErrors([])
        setFunctionValidationWarnings([])
        setHasFunctionUnsavedChanges(false) // Reset unsaved changes for existing template
      }
    }
  }, [activeTab, templates, functionTemplates])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/v1/prompt-engineering/templates') as PromptTemplate[]
      console.log('✅ Templates loaded successfully:', response.length, 'templates')
      setTemplates(response)
      
      // Load the first template if available and on cleaner tab
      if (response.length > 0 && activeTab === 'cleaner') {
        const firstTemplate = response[0]
        setActiveTemplate(firstTemplate)
        setCurrentTemplateId(firstTemplate.id) // Set current template ID for edit mode
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

  const loadFunctionTemplates = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getFunctionPromptTemplates() as FunctionPromptTemplate[]
      console.log('✅ Function templates loaded successfully:', response.length, 'templates')
      setFunctionTemplates(response)
      
      // Load the first function template if available and on function tab
      if (response.length > 0 && activeTab === 'function') {
        const firstTemplate = response[0]
        setCurrentFunctionTemplateId(firstTemplate.id)
        setFunctionPromptName(firstTemplate.name)
        setFunctionPromptDescription(firstTemplate.description || '')
        setFunctionPromptContent(firstTemplate.template)
        
        // Load function descriptions with defaults if empty
        const loadedDescriptions = firstTemplate.custom_function_descriptions || {}
        const descriptionsWithDefaults = { ...loadedDescriptions }
        
        // Fill in any missing function descriptions with defaults
        AVAILABLE_FUNCTIONS.forEach(func => {
          if (!descriptionsWithDefaults[func.name]) {
            descriptionsWithDefaults[func.name] = func.defaultDescription
          }
        })
        
        setCustomFunctionDescriptions(descriptionsWithDefaults)
        
        // Clear validation errors when loading existing template
        setFunctionValidationErrors([])
        setFunctionValidationWarnings([])
        setHasFunctionUnsavedChanges(false) // Reset unsaved changes for existing template
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Load Function Templates', errorMessage)
      setError(`Failed to load function templates: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Real-time validation function
  const validateCurrentTemplate = () => {
    if (!validator) {
      console.warn('Validator not initialized')
      return false
    }

    const validation = validator.validateTemplate(
      templateName,
      editingTemplate,
      templateDescription,
      activeTemplate?.id
    )
    
    console.log('Validation result:', {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      templateName,
      templateLength: editingTemplate.length
    })
    
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
    
    return validation.isValid
  }

  // Debounced validation for real-time typing
  const debouncedValidation = (name: string, content: string, description: string) => {
    if (validationTimeoutId) {
      clearTimeout(validationTimeoutId)
    }
    
    const timeoutId = setTimeout(() => {
      if (validator) {
        const validation = validator.validateTemplate(
          name,
          content,
          description,
          activeTemplate?.id
        )
        
        setValidationErrors(validation.errors)
        setValidationWarnings(validation.warnings)
      }
    }, 300) // 300ms debounce delay
    
    setValidationTimeoutId(timeoutId)
  }

  // Function prompt validation functions  
  const debouncedFunctionValidation = (name: string, content: string, description: string, funcDescriptions?: Record<string, string>) => {
    if (functionValidationTimeoutId) {
      clearTimeout(functionValidationTimeoutId)
    }
    
    const timeoutId = setTimeout(() => {
      // Use passed descriptions or current state
      const descriptionsToValidate = funcDescriptions || customFunctionDescriptions
      
      // Simple validation for function prompt (using proper ValidationError/ValidationWarning types)
      const errors: ValidationError[] = []
      const warnings: ValidationWarning[] = []
      
      if (!name.trim()) {
        errors.push({ field: 'name', type: 'required', message: 'Function prompt name is required' })
      }
      
      if (!content.trim()) {
        errors.push({ field: 'template', type: 'required', message: 'Function prompt content cannot be empty' })
      }
      
      if (!description.trim()) {
        errors.push({ field: 'description', type: 'required', message: 'Function prompt description is required' })
      }
      
      // Validate function descriptions are not empty
      const emptyFunctions = AVAILABLE_FUNCTIONS.filter(func => 
        !descriptionsToValidate[func.name] || !descriptionsToValidate[func.name].trim()
      )
      
      if (emptyFunctions.length > 0) {
        errors.push({ 
          field: 'function_descriptions', 
          type: 'required', 
          message: `Function descriptions cannot be empty for: ${emptyFunctions.map(f => f.name).join(', ')}` 
        })
      }
      
      const requiredVars = ['previous_cleaned_turns', 'customer_profile', 'current_cleaned_turn', 'previous_function_calls']
      const missingRequired = requiredVars.filter(varName => 
        !content.includes(`{${varName}}`)
      )
      
      if (missingRequired.length > 0) {
        warnings.push({ 
          field: 'variables',
          type: 'unused_variable', 
          message: `Consider including required variables: ${missingRequired.join(', ')}` 
        })
      }
      
      setFunctionValidationErrors(errors)
      setFunctionValidationWarnings(warnings)
    }, 300)
    
    setFunctionValidationTimeoutId(timeoutId)
  }

  // Function to extract variables from function prompt template
  const extractVariablesFromFunctionTemplate = (template: string): string[] => {
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

  // Clear function prompt form
  const handleNewFunctionPrompt = () => {
    setCurrentFunctionTemplateId(null) // Clear current template ID for create mode
    setFunctionPromptName('')
    setFunctionPromptDescription('')
    setFunctionPromptContent('')
    
    // Initialize with default function descriptions for new prompts
    const defaultDescriptions: Record<string, string> = {}
    AVAILABLE_FUNCTIONS.forEach(func => {
      defaultDescriptions[func.name] = func.defaultDescription
    })
    setCustomFunctionDescriptions(defaultDescriptions)
    
    setFunctionValidationErrors([])
    setFunctionValidationWarnings([])
    setHasFunctionUnsavedChanges(false)
  }

  // Save function prompt template
  const handleSaveFunctionPrompt = async () => {
    // Basic validation first
    if (!functionPromptName.trim()) {
      templateToasts.showValidationError(['Function prompt name is required'])
      return
    }
    
    if (!functionPromptContent.trim()) {
      templateToasts.showValidationError(['Function prompt content cannot be empty'])
      return
    }
    
    if (!functionPromptDescription.trim()) {
      templateToasts.showValidationError(['Function prompt description is required'])
      return
    }
    
    // Check if there are validation errors
    if (functionValidationErrors.length > 0) {
      const errorMessages = functionValidationErrors.map(error => error.message)
      templateToasts.showValidationError(errorMessages)
      return
    }
    
    try {
      setLoading(true)
      
      // Extract variables from the template
      const detectedVariables = extractVariablesFromFunctionTemplate(functionPromptContent)
      
      if (currentFunctionTemplateId) {
        // UPDATE existing function template
        await apiClient.updateFunctionPromptTemplate(currentFunctionTemplateId, {
          name: functionPromptName,
          description: functionPromptDescription,
          template: functionPromptContent,
          variables: detectedVariables,
          custom_function_descriptions: customFunctionDescriptions
        })
        
        templateToasts.showSaveSuccess(`Updated function prompt "${functionPromptName}"`)
        
        // Reload function templates to get updated data
        await loadFunctionTemplates()
        
      } else {
        // CREATE new function template
        const response = await apiClient.createFunctionPromptTemplate({
          name: functionPromptName,
          description: functionPromptDescription,
          template: functionPromptContent,
          variables: detectedVariables,
          custom_function_descriptions: customFunctionDescriptions
        })
        
        templateToasts.showSaveSuccess(`Created function prompt "${functionPromptName}"`)
        
        // Set the new template as current and reload
        setCurrentFunctionTemplateId((response as FunctionPromptTemplate).id)
        await loadFunctionTemplates()
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const action = currentFunctionTemplateId ? 'Update Function Prompt' : 'Create Function Prompt'
      templateToasts.showApiError(action, errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Save As - always creates new function template
  const handleSaveAsFunctionPrompt = async () => {
    // Basic validation first
    if (!functionPromptName.trim()) {
      templateToasts.showValidationError(['Function prompt name is required'])
      return
    }
    
    if (!functionPromptContent.trim()) {
      templateToasts.showValidationError(['Function prompt content cannot be empty'])
      return
    }
    
    if (!functionPromptDescription.trim()) {
      templateToasts.showValidationError(['Function prompt description is required'])
      return
    }
    
    // Check if there are validation errors
    if (functionValidationErrors.length > 0) {
      const errorMessages = functionValidationErrors.map(error => error.message)
      templateToasts.showValidationError(errorMessages)
      return
    }
    
    try {
      setLoading(true)
      
      // Extract variables from the template
      const detectedVariables = extractVariablesFromFunctionTemplate(functionPromptContent)
      
      // Always create a new template (Save As)
      const response = await apiClient.createFunctionPromptTemplate({
        name: functionPromptName,
        description: functionPromptDescription,
        template: functionPromptContent,
        variables: detectedVariables,
        custom_function_descriptions: customFunctionDescriptions
      })
      
      templateToasts.showSaveSuccess(`Created function prompt "${functionPromptName}"`)
      
      // Set the new template as current and reload
      setCurrentFunctionTemplateId((response as FunctionPromptTemplate).id)
      await loadFunctionTemplates()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      templateToasts.showApiError('Save As Function Prompt', errorMessage)
    } finally {
      setLoading(false)
    }
    
    // Clear validation errors after successful save
    setFunctionValidationErrors([])
    setFunctionValidationWarnings([])
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

  // Track unsaved changes for cleaner templates
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

  // Track unsaved changes for function templates
  useEffect(() => {
    if (currentFunctionTemplateId) {
      const currentTemplate = functionTemplates.find(t => t.id === currentFunctionTemplateId)
      if (currentTemplate) {
        const hasNameChange = currentTemplate.name !== functionPromptName
        const hasDescriptionChange = (currentTemplate.description || '') !== functionPromptDescription
        const hasContentChange = currentTemplate.template !== functionPromptContent
        
        // Check if function descriptions have changed
        const originalDescriptions = currentTemplate.custom_function_descriptions || {}
        const hasFunctionDescriptionChange = AVAILABLE_FUNCTIONS.some(func => {
          const original = originalDescriptions[func.name] || func.defaultDescription
          const current = customFunctionDescriptions[func.name] || ''
          return original !== current
        })
        
        setHasFunctionUnsavedChanges(hasNameChange || hasDescriptionChange || hasContentChange || hasFunctionDescriptionChange)
      }
    } else {
      // For new templates, check if any field has content
      const hasContent = functionPromptName.trim() !== '' || 
                        functionPromptDescription.trim() !== '' || 
                        functionPromptContent.trim() !== ''
      setHasFunctionUnsavedChanges(hasContent)
    }
  }, [functionPromptName, functionPromptDescription, functionPromptContent, customFunctionDescriptions, currentFunctionTemplateId, functionTemplates])

  // Template CRUD operations with validation
  const handleTemplateNameChange = (name: string) => {
    setTemplateName(name)
    setHasUnsavedChanges(true)
    
    // Run debounced validation for real-time feedback
    debouncedValidation(name, editingTemplate, templateDescription)
  }

  const handleTemplateContentChange = (content: string) => {
    setEditingTemplate(content)
    setHasUnsavedChanges(true)
    
    // Run debounced validation for real-time feedback
    debouncedValidation(templateName, content, templateDescription)
  }

  const handleTemplateDescriptionChange = (description: string) => {
    setTemplateDescription(description)
    setHasUnsavedChanges(true)
    
    // Run debounced validation for real-time feedback
    debouncedValidation(templateName, editingTemplate, description)
  }

  // Function prompt change handlers
  const handleFunctionPromptNameChange = (name: string) => {
    setFunctionPromptName(name)
    debouncedFunctionValidation(name, functionPromptContent, functionPromptDescription)
  }

  const handleFunctionPromptContentChange = (content: string) => {
    setFunctionPromptContent(content)
    debouncedFunctionValidation(functionPromptName, content, functionPromptDescription)
  }

  const handleFunctionPromptDescriptionChange = (description: string) => {
    setFunctionPromptDescription(description)
    debouncedFunctionValidation(functionPromptName, functionPromptContent, description)
  }

  const handleFunctionDescriptionChange = (functionName: string, description: string) => {
    const updatedDescriptions = {
      ...customFunctionDescriptions,
      [functionName]: description
    }
    setCustomFunctionDescriptions(updatedDescriptions)
    
    // Re-run validation with the updated descriptions immediately
    debouncedFunctionValidation(functionPromptName, functionPromptContent, functionPromptDescription, updatedDescriptions)
  }


  // Smart Save System - handles both create and update
  const handleSave = async () => {
    // Validate before saving
    const isValid = validateCurrentTemplate()
    
    // Check if template name is provided first (basic validation)
    if (!templateName.trim()) {
      templateToasts.showValidationError(['Template name is required'])
      return
    }

    if (!isValid) {
      console.log('Validation failed. Current state:', {
        validationErrors,
        validationWarnings,
        templateName: templateName.trim(),
        templateContent: editingTemplate.substring(0, 100) + '...',
        isValid
      })
      
      const errorMessages = validationErrors.length > 0 
        ? validationErrors.map(formatValidationMessage)
        : ['Template validation failed. Please check your template for errors.']
      
      console.log('Formatted error messages:', errorMessages)
      templateToasts.showValidationError(errorMessages)
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
      const errorMessages = validationErrors.length > 0 
        ? validationErrors.map(formatValidationMessage)
        : ['Template validation failed. Please check your template for errors.']
      
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


  // Template Library Modal Handlers
  const handleEditTemplate = (template: PromptTemplate | FunctionPromptTemplate) => {
    if (activeTab === 'cleaner') {
      setCurrentTemplateId(template.id)
      setActiveTemplate(template as PromptTemplate)
      setEditingTemplate(template.template)
      setTemplateName(template.name)
      setTemplateDescription(template.description || '')
      setShowTemplateLibrary(false)
    } else {
      const funcTemplate = template as FunctionPromptTemplate
      setCurrentFunctionTemplateId(funcTemplate.id)
      setFunctionPromptName(funcTemplate.name)
      setFunctionPromptDescription(funcTemplate.description || '')
      setFunctionPromptContent(funcTemplate.template)
      
      // Load function descriptions with defaults if empty
      const loadedDescriptions = funcTemplate.custom_function_descriptions || {}
      const descriptionsWithDefaults = { ...loadedDescriptions }
      
      // Fill in any missing function descriptions with defaults
      AVAILABLE_FUNCTIONS.forEach(func => {
        if (!descriptionsWithDefaults[func.name]) {
          descriptionsWithDefaults[func.name] = func.defaultDescription
        }
      })
      
      setCustomFunctionDescriptions(descriptionsWithDefaults)
      setShowTemplateLibrary(false)
      
      // Clear validation errors when loading existing template
      setFunctionValidationErrors([])
      setFunctionValidationWarnings([])
      setHasFunctionUnsavedChanges(false) // Reset unsaved changes flag
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (activeTab === 'cleaner') {
      const template = templates.find(t => t.id === templateId)
      if (!template) return

      try {
        await apiClient.delete(`/api/v1/prompt-engineering/templates/${templateId}`)
        await loadTemplates()
        templateToasts.showDeleteSuccess(template.name)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        
        // Handle constraint-specific errors
        if (errorMessage.includes('Cannot delete the last remaining')) {
          templateToasts.showApiError('Cannot Delete Template', 'Cannot delete the last remaining prompt template. At least one template must exist.')
        } else {
          templateToasts.showApiError('Delete Template', errorMessage)
        }
      }
    } else {
      const template = functionTemplates.find(t => t.id === templateId)
      if (!template) return
      
      try {
        await apiClient.deleteFunctionPromptTemplate(templateId)
        await loadFunctionTemplates()
        templateToasts.showDeleteSuccess(template.name)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        templateToasts.showApiError('Delete Function Template', errorMessage)
      }
    }
  }

  const handleDuplicateTemplate = async (template: PromptTemplate | FunctionPromptTemplate) => {
    try {
      const newName = `${template.name} (Copy)`
      
      if (activeTab === 'cleaner') {
        await apiClient.post('/api/v1/prompt-engineering/templates', {
          name: newName,
          template: template.template,
          description: template.description,
          variables: template.variables
        })
        await loadTemplates()
      } else {
        const funcTemplate = template as FunctionPromptTemplate
        await apiClient.createFunctionPromptTemplate({
          name: newName,
          template: funcTemplate.template,
          description: funcTemplate.description || '',
          variables: funcTemplate.variables,
          custom_function_descriptions: funcTemplate.custom_function_descriptions || {}
        })
        await loadFunctionTemplates()
      }
      
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

  const handleSetAsDefault = async (templateId: string) => {
    if (activeTab === 'cleaner') {
      const template = templates.find(t => t.id === templateId)
      if (!template) return

      try {
        await apiClient.post(`/api/v1/prompt-engineering/templates/${templateId}/set-default`)
        await loadTemplates()
        templateToasts.showActivateSuccess(template.name)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        templateToasts.showApiError('Set Default Template', errorMessage)
      }
    } else {
      const template = functionTemplates.find(t => t.id === templateId)
      if (!template) return

      try {
        await apiClient.setFunctionPromptTemplateAsDefault(templateId)
        await loadFunctionTemplates()
        templateToasts.showActivateSuccess(template.name)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        templateToasts.showApiError('Set Default Function Template', errorMessage)
      }
    }
  }


  const loadConversations = async () => {
    try {
      const response = await apiClient.get('/api/v1/conversations') as { conversations: {id: string; name: string; created_at: string}[] }
      setConversations(response.conversations || [])
    } catch (err) {
      setError(`Failed to load conversations: ${err}`)
    }
  }

  const loadConversationTurns = async (conversationId: string) => {
    try {
      const response = await apiClient.get(`/api/v1/conversations/${conversationId}/turns`) as { turns: {id: string; speaker: string; raw_text: string; cleaned_text: string}[] }
      setConversationTurns(response.turns || [])
    } catch (err) {
      setError(`Failed to load conversation turns: ${err}`)
    }
  }

  const loadTestConversations = async () => {
    try {
      const response = await apiClient.get('/api/v1/prompt-engineering/test-conversations') as {id: string; name: string; description: string; variables: object}[]
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

      const response = await apiClient.post(`/api/v1/prompt-engineering/templates/${activeTemplate.id}/simulate/conversation`, payload) as {
        mode: string; 
        results: Array<{
          turn_index: number;
          speaker: string;
          raw_text: string;
          success: boolean;
          cleaned_text?: string;
          context_turns_used?: number;
          rendered_prompt?: string;
          token_count?: number;
          error?: string;
        }>;
        summary?: {
          successful_renders: number;
          total_turns_tested: number;
        };
        token_count?: number;
        rendered_prompt?: string;
      }
      setConversationSimulationResult(response)
    } catch (err) {
      setError(`Failed to simulate with conversation: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const simulatePrompt = async () => {
    if (!activeTemplate) return
    
    if (dataSource === 'test') {
      // Test data simulation
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
        
        console.log('Test simulation result:', response)
        templateToasts.showSaveSuccess('Test Simulation Complete')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        templateToasts.showApiError('Test Simulation', errorMessage)
      }
    } else if (dataSource === 'real' && selectedConversationId) {
      // Real conversation simulation
      await simulateWithConversation()
    } else {
      templateToasts.showApiError('Invalid Configuration', 'Please select a conversation or configure test data.')
    }
  }

  return (
    <div style={{ 
      height: '100vh', 
      backgroundColor: theme.bg, 
      color: theme.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: theme.bgSecondary, 
        borderBottom: `1px solid ${theme.border}`,
        padding: '12px 24px',
        flexShrink: 0
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
              📚 {activeTab === 'cleaner' ? 'Template Library' : 'Function Library'} ({activeTab === 'cleaner' ? templates.length : functionTemplates.length})
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
              Active: {activeTab === 'cleaner' 
                ? (activeTemplate?.name || 'None') 
                : (functionTemplates.find(t => t.id === currentFunctionTemplateId)?.name || 'None')
              }
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        backgroundColor: theme.bgSecondary, 
        borderBottom: `1px solid ${theme.border}`,
        padding: '0 24px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { id: 'cleaner', label: '🧹 Cleaner Prompt', desc: 'Edit conversation cleaning prompts' },
            { id: 'function', label: '⚡ Function Prompt', desc: 'Edit function calling prompts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'cleaner' | 'function')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === tab.id ? theme.bg : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${theme.accent}` : '2px solid transparent',
                color: activeTab === tab.id ? theme.text : theme.textMuted,
                cursor: 'pointer',
                fontSize: '13px',
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
      <div style={{ 
        flex: 1,
        padding: '16px', 
        maxWidth: '1400px', 
        margin: '0 auto',
        overflow: 'hidden',
        width: '100%'
      }}>
        
        {/* Cleaner Prompt Tab */}
        {activeTab === 'cleaner' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px', 
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Left Panel - Template Editor */}
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
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

              {/* Scrollable Form Content */}
              <div style={{ 
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Template Metadata */}
                <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
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

              {/* Monaco Editor Container with Validation Feedback */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
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
                
                {/* Validation Feedback - Takes up space below editor */}
                {(validationErrors.length > 0 || validationWarnings.length > 0) && (
                  <div style={{ 
                    backgroundColor: darkMode ? '#1e1e1e' : '#f8f9fa',
                    borderTop: `1px solid ${theme.border}`,
                    padding: '8px 12px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    flexShrink: 0,
                    boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)'
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
              </div>
              </div> {/* Close scrollable form content */}
            </div>

            {/* Right Panel - Preview & Variables */}
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Right Panel Header */}
              <div style={{ 
                padding: '16px',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <h3 style={{ margin: 0 }}>Testing & Preview</h3>
                <button
                  onClick={simulatePrompt}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: theme.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  🚀 Test Prompt
                </button>
              </div>
              
              {/* Scrollable Content */}
              <div style={{ 
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '16px'
              }}>
              
                {/* Data Source Selection */}
                <div style={{ 
                  backgroundColor: theme.bg,
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
                    customer_profile <span style={{ color: theme.warning }}>(optional)</span>
                  </label>
                  <textarea
                    value={previewVariables.customer_profile}
                    onChange={(e) => setPreviewVariables({...previewVariables, customer_profile: e.target.value})}
                    placeholder="Customer profile and business context..."
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

                    <div style={{
                      padding: '12px',
                      backgroundColor: theme.bgTertiary,
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: theme.textMuted,
                      textAlign: 'center'
                    }}>
                      Click "🚀 Test Prompt" in the header to run simulation
                    </div>
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

                        <div style={{
                          padding: '12px',
                          backgroundColor: theme.bgTertiary,
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: theme.textMuted,
                          textAlign: 'center'
                        }}>
                          Click "🚀 Test Prompt" in the header to run with {testingMode === 'single_turn' ? 'Single Turn' : 'Full Conversation'}
                        </div>
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
                        {conversationSimulationResult.results?.slice(0, 5).map((result, i) => (
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
          </div>
        )}

        {/* Function Prompt Tab */}
        {activeTab === 'function' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px', 
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Left Panel - Function Prompt Editor */}
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '16px',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ margin: 0 }}>
                  Function Calling Prompt Editor
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleNewFunctionPrompt}
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
                    onClick={handleSaveFunctionPrompt}
                    disabled={loading || functionValidationErrors.length > 0 || !hasFunctionUnsavedChanges}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: (loading || functionValidationErrors.length > 0 || !hasFunctionUnsavedChanges) ? theme.bgTertiary : theme.success,
                      color: (loading || functionValidationErrors.length > 0 || !hasFunctionUnsavedChanges) ? theme.textMuted : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (loading || functionValidationErrors.length > 0 || !hasFunctionUnsavedChanges) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '⏳ Saving...' : (currentFunctionTemplateId ? '💾 Save' : '✅ Create')}
                  </button>
                  {currentFunctionTemplateId && (
                    <button
                      onClick={handleSaveAsFunctionPrompt}
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

              {/* Scrollable Form Content */}
              <div style={{ 
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Function Prompt Metadata */}
                <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                      Function Prompt Name
                    </label>
                    <input
                      type="text"
                      value={functionPromptName}
                      onChange={(e) => handleFunctionPromptNameChange(e.target.value)}
                      placeholder="Enter function prompt name..."
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
                      value={functionPromptDescription}
                      onChange={(e) => handleFunctionPromptDescriptionChange(e.target.value)}
                      placeholder="Describe the function calling behavior..."
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

                {/* Monaco Editor Container */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                  <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                    <Editor
                      height="100%"
                      defaultLanguage="text"
                      value={functionPromptContent}
                      onChange={(value) => handleFunctionPromptContentChange(value || '')}
                      onMount={(editor: any) => {
                        setMonacoEditor(editor)
                      }}
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
                  
                  {/* Function Prompt Validation Feedback */}
                  {(functionValidationErrors.length > 0 || functionValidationWarnings.length > 0) && (
                    <div style={{ 
                      backgroundColor: darkMode ? '#1e1e1e' : '#f8f9fa',
                      borderTop: `1px solid ${theme.border}`,
                      padding: '8px 12px',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      flexShrink: 0,
                      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)'
                    }}>
                      {functionValidationErrors.map((error, index) => (
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
                      {functionValidationWarnings.map((warning, index) => (
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
                </div>
              </div>
            </div>

            {/* Right Panel - Empty for now */}
            <div style={{ 
              backgroundColor: theme.bgSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible'
            }}>
              {/* Right Panel Header */}
              <div style={{ 
                padding: '16px',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <h3 style={{ margin: 0 }}>Function Testing & Preview</h3>
              </div>
              
              {/* Function Variables Information */}
              <div style={{ 
                flex: 1,
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '16px'
              }}>
                
                {/* Variable System Info Card */}
                <div style={{ 
                  backgroundColor: theme.bg,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  padding: '16px',
                  overflow: 'visible'
                }}>
                  {/* Variable List with Hover Tooltips */}
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: theme.text }}>Available Variables</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', position: 'relative' }}>
                      {[
                        { name: 'previous_cleaned_turns', required: true, tooltip: 'REQUIRED: The previous cleaned conversation history from earlier turns, formatted as speaker-turn pairs' },
                        { name: 'customer_profile', required: true, tooltip: 'REQUIRED: Customer profile and business context including user data (name, title, company) and current state' },
                        { name: 'current_cleaned_turn', required: true, tooltip: 'REQUIRED: The current turn being analyzed for function calling - the cleaned text from this specific turn' },
                        { name: 'previous_function_calls', required: true, tooltip: 'REQUIRED: History of functions already called in this session to avoid duplicates and maintain state' },
                        { name: 'additional_context', required: false, tooltip: 'OPTIONAL: Free-form context for custom business rules, special instructions, or testing scenarios' }
                      ].map((variable) => (
                        <span
                          key={variable.name}
                          onClick={() => {
                            if (monacoEditor) {
                              const position = monacoEditor.getPosition()
                              if (position) {
                                monacoEditor.executeEdits('click-insert', [{
                                  range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column
                                  },
                                  text: `{${variable.name}}`
                                }])
                                
                                // Move cursor after inserted text
                                monacoEditor.setPosition({
                                  lineNumber: position.lineNumber,
                                  column: position.column + variable.name.length + 2
                                })
                                
                                // Focus back to editor
                                monacoEditor.focus()
                              }
                            }
                          }}
                          onMouseEnter={() => setHoveredVariable(variable.name)}
                          onMouseLeave={() => setHoveredVariable(null)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            backgroundColor: theme.bgTertiary,
                            borderRadius: '12px',
                            border: `1px solid ${theme.border}`,
                            fontSize: '11px',
                            cursor: 'pointer',
                            position: 'relative',
                            userSelect: 'none'
                          }}
                        >
                          <span style={{ 
                            width: '6px', 
                            height: '6px', 
                            borderRadius: '50%', 
                            backgroundColor: variable.required ? theme.error : theme.warning 
                          }}></span>
                          <span style={{ color: theme.textSecondary, fontFamily: 'monospace' }}>
                            {variable.name}
                          </span>
                          
                          {/* Custom Tooltip */}
                          {hoveredVariable === variable.name && (
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              padding: '8px 12px',
                              backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                              border: `1px solid ${theme.border}`,
                              borderRadius: '6px',
                              boxShadow: darkMode 
                                ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
                                : '0 4px 12px rgba(0, 0, 0, 0.15)',
                              fontSize: '11px',
                              color: theme.text,
                              whiteSpace: 'normal',
                              zIndex: 9999,
                              maxWidth: '750px',
                              minWidth: '300px'
                            }}>
                              {variable.tooltip}
                              {/* Tooltip arrow */}
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: `6px solid ${theme.border}`
                              }}></div>
                            </div>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    padding: '12px',
                    backgroundColor: theme.bgTertiary,
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: theme.textMuted,
                    textAlign: 'center',
                    border: `1px solid ${theme.border}`
                  }}>
                    Click variables to insert them at cursor position
                  </div>
                </div>

                {/* Function Descriptions Card */}
                <div style={{ 
                  backgroundColor: theme.bg,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  padding: '16px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: theme.text }}>Function Descriptions</h4>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '12px' }}>
                    Define how each function should be called by the AI.
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                    {AVAILABLE_FUNCTIONS.map((func) => (
                      <div key={func.name} style={{
                        padding: '8px',
                        backgroundColor: theme.bgTertiary,
                        borderRadius: '4px',
                        border: `1px solid ${theme.border}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: theme.text }}>
                            {func.name}
                          </label>
                          <button
                            onClick={() => setCustomFunctionDescriptions(prev => ({ ...prev, [func.name]: func.defaultDescription }))}
                            style={{
                              padding: '2px 6px',
                              fontSize: '9px',
                              backgroundColor: theme.bg,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '3px',
                              cursor: 'pointer',
                              color: theme.textMuted
                            }}
                            title="Load default description"
                          >
                            Reset to Default
                          </button>
                        </div>
                        <textarea
                          value={customFunctionDescriptions[func.name] || ''}
                          onChange={(e) => handleFunctionDescriptionChange(func.name, e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '6px',
                            fontSize: '10px',
                            backgroundColor: theme.bg,
                            border: `1px solid ${(!customFunctionDescriptions[func.name] || !customFunctionDescriptions[func.name].trim()) ? theme.error : theme.border}`,
                            borderRadius: '3px',
                            color: theme.text,
                            resize: 'vertical',
                            fontFamily: 'monospace',
                            lineHeight: '1.3'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Testing Instructions Card */}
                <div style={{ 
                  backgroundColor: theme.bg,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  padding: '16px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Testing Instructions</h4>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, lineHeight: '1.5' }}>
                    <strong style={{ color: theme.text }}>Expected Output Format:</strong><br/>
                    • <strong>FUNCTION_CALL:</strong> function_name(parameters) - when a function should be executed<br/>
                    • <strong>NO_FUNCTION_CALL</strong> - when no action is needed<br/>
                    • <strong>CONFIDENCE:</strong> HIGH/MEDIUM/LOW - confidence level<br/>
                    <br/>
                    <strong style={{ color: theme.text }}>Test with mock data:</strong><br/>
                    Scott (Head of Marketing) at Quick Fit Windows conversations will be processed against actual function execution.
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* Template Library Modal */}
      <TemplateLibraryModal
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        templates={activeTab === 'cleaner' ? templates : functionTemplates}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onDuplicate={handleDuplicateTemplate}
        onSetAsDefault={handleSetAsDefault}
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