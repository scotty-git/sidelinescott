import React, { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

interface VariableInputProps {
  variable: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

interface VariableSuggestion {
  value: string
  lastUsed: string
}

export const VariableInput: React.FC<VariableInputProps> = ({
  variable,
  value,
  onChange,
  placeholder,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load suggestions when component mounts
  useEffect(() => {
    loadSuggestions()
  }, [variable])

  const loadSuggestions = async () => {
    try {
      setIsLoading(true)
      const suggestions = await apiClient.getVariableSuggestions(variable)
      setSuggestions(suggestions as string[])
    } catch (error) {
      console.error('Failed to load variable suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  const saveVariableValue = async (newValue: string) => {
    if (!newValue.trim()) return
    
    try {
      await apiClient.saveVariableValue(variable, newValue)
      
      // Refresh suggestions after saving
      loadSuggestions()
    } catch (error) {
      console.error('Failed to save variable value:', error)
    }
  }

  const handleValueChange = (newValue: string) => {
    onChange(newValue)
    if (newValue.trim() && !suggestions.includes(newValue)) {
      // Save new value for future suggestions
      saveVariableValue(newValue)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestions(false)
    saveVariableValue(suggestion) // Update last used time
  }

  const getVariableDisplayName = (variable: string): string => {
    switch (variable) {
      case 'call_context':
        return 'Call Context'
      case 'additional_context':
        return 'Additional Context'
      default:
        return variable.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const getVariableDescription = (variable: string): string => {
    switch (variable) {
      case 'call_context':
        return 'Business context from prequalification flow'
      case 'additional_context':
        return 'User-defined additional context for cleaning'
      default:
        return `Value for ${variable} variable`
    }
  }

  return (
    <div className={`variable-input ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {getVariableDisplayName(variable)}
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-normal">
          {getVariableDescription(variable)}
        </div>
      </label>
      
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay hiding suggestions to allow clicks
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          placeholder={placeholder || `Enter ${getVariableDisplayName(variable).toLowerCase()}...`}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 resize-vertical min-h-[60px] bg-white dark:bg-gray-800 dark:text-white"
          rows={2}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              Previously used values:
            </div>
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="truncate">{suggestion}</div>
              </div>
            ))}
          </div>
        )}
        
        {isLoading && (
          <div className="absolute right-2 top-2 text-gray-400">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

// Higher-order component for managing multiple variables
interface VariableManagerProps {
  templateVariables: string[]
  values: Record<string, string>
  onChange: (variable: string, value: string) => void
  className?: string
}

export const VariableManager: React.FC<VariableManagerProps> = ({
  templateVariables,
  values,
  onChange,
  className = ''
}) => {
  const userVariables = templateVariables.filter(v => 
    ['call_context', 'additional_context'].includes(v)
  )

  if (userVariables.length === 0) {
    return null
  }

  return (
    <div className={`variable-manager ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Template Variables
      </h3>
      
      <div className="space-y-4">
        {userVariables.map((variable) => (
          <VariableInput
            key={variable}
            variable={variable}
            value={values[variable] || ''}
            onChange={(value) => onChange(variable, value)}
          />
        ))}
      </div>
    </div>
  )
}