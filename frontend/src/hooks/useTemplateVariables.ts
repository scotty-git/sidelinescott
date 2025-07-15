import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

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

interface TemplateVariableInfo {
  requiredSystemVars: string[]
  optionalUserVars: string[]
  allDetected: string[]
  needsUserInput: boolean
}

export const useTemplateVariables = (templateId: string | null) => {
  const [template, setTemplate] = useState<PromptTemplate | null>(null)
  const [variableInfo, setVariableInfo] = useState<TemplateVariableInfo>({
    requiredSystemVars: [],
    optionalUserVars: [],
    allDetected: [],
    needsUserInput: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    } else {
      setTemplate(null)
      setVariableInfo({
        requiredSystemVars: [],
        optionalUserVars: [],
        allDetected: [],
        needsUserInput: false
      })
    }
  }, [templateId])

  const loadTemplate = async (id: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/prompt-engineering/templates/${id}`)
      const templateData = response.data
      setTemplate(templateData)
      
      // Analyze variables from the template
      const allVariables = templateData.variables || []
      const userVariables = allVariables.filter((v: string) => 
        ['call_context', 'additional_context'].includes(v)
      )
      const systemVariables = allVariables.filter((v: string) => 
        ['raw_text', 'conversation_context', 'cleaning_level'].includes(v)
      )
      
      setVariableInfo({
        requiredSystemVars: systemVariables,
        optionalUserVars: userVariables,
        allDetected: allVariables,
        needsUserInput: userVariables.length > 0
      })
      
    } catch (error) {
      console.error('Failed to load template:', error)
      setError('Failed to load template')
    } finally {
      setIsLoading(false)
    }
  }

  const validateUserVariables = (userVariables: Record<string, string>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    for (const variable of variableInfo.optionalUserVars) {
      const value = userVariables[variable]
      if (!value || !value.trim()) {
        const displayName = variable.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        errors.push(`${displayName} is required for this template`)
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const getVariableDescription = (variable: string): string => {
    switch (variable) {
      case 'call_context':
        return 'Business context from prequalification flow'
      case 'additional_context':
        return 'User-defined additional context for cleaning'
      case 'raw_text':
        return 'Current user input text to be cleaned (automatically provided)'
      case 'conversation_context':
        return 'Previous cleaned conversation turns for context (automatically provided)'
      case 'cleaning_level':
        return 'Cleaning level: light, full, or auto (automatically provided)'
      default:
        return `Value for ${variable} variable`
    }
  }

  return {
    template,
    variableInfo,
    isLoading,
    error,
    validateUserVariables,
    getVariableDescription
  }
}

// Hook for managing user variable values
export const useUserVariables = (templateId: string | null) => {
  const [userVariables, setUserVariables] = useState<Record<string, string>>({})
  const { variableInfo } = useTemplateVariables(templateId)

  useEffect(() => {
    // Initialize user variables when template changes
    const initialValues: Record<string, string> = {}
    variableInfo.optionalUserVars.forEach(variable => {
      initialValues[variable] = userVariables[variable] || ''
    })
    setUserVariables(initialValues)
  }, [templateId, variableInfo.optionalUserVars])

  const setUserVariable = (variable: string, value: string) => {
    setUserVariables(prev => ({
      ...prev,
      [variable]: value
    }))
  }

  const clearUserVariables = () => {
    setUserVariables({})
  }

  const getUserVariablesForAPI = () => {
    // Only return variables that have values
    const filteredVariables: Record<string, string> = {}
    Object.entries(userVariables).forEach(([key, value]) => {
      if (value && value.trim()) {
        filteredVariables[key] = value
      }
    })
    return filteredVariables
  }

  return {
    userVariables,
    setUserVariable,
    clearUserVariables,
    getUserVariablesForAPI
  }
}