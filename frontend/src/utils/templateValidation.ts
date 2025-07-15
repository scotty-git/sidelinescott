// Template validation utility with comprehensive error handling

export interface ValidationError {
  field: 'name' | 'template' | 'variables' | 'description'
  type: 'required' | 'duplicate' | 'invalid_syntax' | 'missing_variable' | 'too_long' | 'invalid_characters'
  message: string
  line?: number
  column?: number
  suggestion?: string
}

export interface ValidationWarning {
  field: 'name' | 'template' | 'variables' | 'description'
  type: 'unused_variable' | 'long_template' | 'many_variables' | 'no_description'
  message: string
  suggestion?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

export interface VariableSuggestion {
  name: string
  type: 'detected' | 'common' | 'recommended'
  description?: string
}

// Supported 5-variable system
export const SUPPORTED_VARIABLES = {
  raw_text: { 
    required: true, 
    description: 'The original text to be cleaned',
    example: 'So umm, like, I was thinking...'
  },
  conversation_context: { 
    required: true, 
    description: 'Previous conversation turns for context',
    example: 'User: Hello\\nLumen: Hi there!'
  },
  cleaning_level: { 
    required: false, 
    description: 'Level of cleaning to apply (provided by UI config)',
    example: 'full'
  },
  call_context: { 
    required: false, 
    description: 'Business context from prequalification',
    example: 'Enterprise sales call, technical discussion'
  },
  additional_context: { 
    required: false, 
    description: 'User-defined additional context',
    example: 'Focus on preserving technical terms'
  }
}

export class TemplateValidator {
  private existingTemplates: Array<{ id: string; name: string }> = []

  constructor(existingTemplates: Array<{ id: string; name: string }> = []) {
    this.existingTemplates = existingTemplates
  }

  // Main validation function
  validateTemplate(
    name: string,
    template: string,
    description: string = '',
    currentTemplateId?: string
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const suggestions: string[] = []

    // Validate name
    const nameValidation = this.validateTemplateName(name, currentTemplateId)
    errors.push(...nameValidation.errors)
    warnings.push(...nameValidation.warnings)

    // Validate template content
    const templateValidation = this.validateTemplateContent(template)
    if (templateValidation.errors && templateValidation.errors.length > 0) {
      errors.push(...templateValidation.errors)
    }
    if (templateValidation.warnings && templateValidation.warnings.length > 0) {
      warnings.push(...templateValidation.warnings)
    }

    // Validate variables
    const variableValidation = this.validateVariables(template)
    if (variableValidation.errors && variableValidation.errors.length > 0) {
      errors.push(...variableValidation.errors)
    }
    if (variableValidation.warnings && variableValidation.warnings.length > 0) {
      warnings.push(...variableValidation.warnings)
    }

    // Validate description
    const descriptionValidation = this.validateDescription(description)
    warnings.push(...descriptionValidation.warnings)

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(template))

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
    
    console.log('Validation result:', {
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => ({ field: e.field, type: e.type, message: e.message })),
      warnings: warnings.map(w => ({ field: w.field, type: w.type, message: w.message }))
    })
    
    return result
  }

  // Validate template name
  private validateTemplateName(name: string, currentId?: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required check
    if (!name.trim()) {
      errors.push({
        field: 'name',
        type: 'required',
        message: 'Template name is required',
        suggestion: 'Enter a descriptive name for your template'
      })
      return { errors, warnings }
    }

    // Length check
    if (name.length > 100) {
      errors.push({
        field: 'name',
        type: 'too_long',
        message: 'Template name must be 100 characters or less',
        suggestion: 'Shorten the template name'
      })
    }

    // Invalid characters check
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(name)) {
      errors.push({
        field: 'name',
        type: 'invalid_characters',
        message: 'Template name contains invalid characters',
        suggestion: 'Remove special characters like < > : " / \\ | ? *'
      })
    }

    // Duplicate check
    const duplicate = this.existingTemplates.find(
      t => t.name.toLowerCase() === name.toLowerCase() && t.id !== currentId
    )
    if (duplicate) {
      errors.push({
        field: 'name',
        type: 'duplicate',
        message: 'A template with this name already exists',
        suggestion: 'Choose a unique name or add a version suffix'
      })
    }

    // Warning for very short names
    if (name.length < 3) {
      warnings.push({
        field: 'name',
        type: 'no_description',
        message: 'Template name is very short',
        suggestion: 'Consider using a more descriptive name'
      })
    }

    return { errors, warnings }
  }

  // Validate template content
  private validateTemplateContent(template: string): Partial<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required check
    if (!template.trim()) {
      errors.push({
        field: 'template',
        type: 'required',
        message: 'Template content is required',
        suggestion: 'Enter your prompt template with variable placeholders'
      })
      return { errors, warnings }
    }

    // Check for unmatched braces
    const braceValidation = this.validateBraceSyntax(template)
    errors.push(...braceValidation.errors)

    // Length warnings
    if (template.length > 5000) {
      warnings.push({
        field: 'template',
        type: 'long_template',
        message: 'Template is very long and may impact performance',
        suggestion: 'Consider breaking into smaller, focused templates'
      })
    }

    // Check for common mistakes
    const commonMistakes = this.checkCommonMistakes(template)
    warnings.push(...commonMistakes)

    return { errors, warnings }
  }

  // Validate brace syntax for variables
  private validateBraceSyntax(template: string): { errors: ValidationError[] } {
    const errors: ValidationError[] = []
    const lines = template.split('\n')
    
    lines.forEach((line, lineIndex) => {
      let braceCount = 0
      let inVariable = false
      let variableStart = -1
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (char === '{') {
          if (inVariable) {
            errors.push({
              field: 'template',
              type: 'invalid_syntax',
              message: 'Nested braces are not allowed',
              line: lineIndex + 1,
              column: i + 1,
              suggestion: 'Use only single-level braces like {variable_name}'
            })
          }
          braceCount++
          inVariable = true
          variableStart = i
        } else if (char === '}') {
          if (!inVariable) {
            errors.push({
              field: 'template',
              type: 'invalid_syntax',
              message: 'Closing brace without opening brace',
              line: lineIndex + 1,
              column: i + 1,
              suggestion: 'Remove the extra closing brace or add an opening brace'
            })
          }
          braceCount--
          inVariable = false
          
          // Validate variable name
          if (variableStart >= 0) {
            const variableName = line.substring(variableStart + 1, i)
            if (!variableName.trim()) {
              errors.push({
                field: 'template',
                type: 'invalid_syntax',
                message: 'Empty variable name',
                line: lineIndex + 1,
                column: variableStart + 1,
                suggestion: 'Provide a variable name between braces'
              })
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName)) {
              errors.push({
                field: 'template',
                type: 'invalid_syntax',
                message: `Invalid variable name: ${variableName}`,
                line: lineIndex + 1,
                column: variableStart + 1,
                suggestion: 'Use only letters, numbers, and underscores. Start with letter or underscore'
              })
            }
          }
        }
      }
      
      if (braceCount !== 0) {
        errors.push({
          field: 'template',
          type: 'invalid_syntax',
          message: braceCount > 0 ? 'Unclosed variable brace' : 'Extra closing brace',
          line: lineIndex + 1,
          suggestion: 'Ensure all variable braces are properly matched'
        })
      }
    })
    
    return { errors }
  }

  // Validate variables against the 5-variable system
  private validateVariables(template: string): Partial<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    
    const detectedVariables = this.extractVariables(template)
    
    // Check for unsupported variables
    const unsupportedVars = detectedVariables.filter(v => !(v in SUPPORTED_VARIABLES))
    if (unsupportedVars.length > 0) {
      errors.push({
        field: 'variables',
        type: 'invalid_syntax',
        message: `Unsupported variables: ${unsupportedVars.join(', ')}`,
        suggestion: `Use only supported variables: ${Object.keys(SUPPORTED_VARIABLES).join(', ')}`
      })
    }
    
    // Check for missing required variables
    const requiredVars = Object.entries(SUPPORTED_VARIABLES)
      .filter(([, config]) => config.required)
      .map(([name]) => name)
    
    const missingRequired = requiredVars.filter(v => !detectedVariables.includes(v))
    if (missingRequired.length > 0) {
      errors.push({
        field: 'variables',
        type: 'missing_variable',
        message: `Missing required variables: ${missingRequired.join(', ')}`,
        suggestion: 'Add the required variables to your template'
      })
    }
    
    // Warning for too many variables
    if (detectedVariables.length > Object.keys(SUPPORTED_VARIABLES).length) {
      warnings.push({
        field: 'variables',
        type: 'many_variables',
        message: 'Template uses many variables',
        suggestion: 'Consider simplifying to improve maintainability'
      })
    }
    
    return { errors, warnings }
  }

  // Validate description
  private validateDescription(description: string): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = []
    
    if (!description.trim()) {
      warnings.push({
        field: 'description',
        type: 'no_description',
        message: 'No description provided',
        suggestion: 'Add a description to help others understand this template'
      })
    }
    
    return { warnings }
  }

  // Extract variables from template
  private extractVariables(template: string): string[] {
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

  // Check for common template mistakes
  private checkCommonMistakes(template: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = []
    
    // Check for hardcoded values that should be variables
    const hardcodedPatterns = [
      { pattern: /\\b(light|full|none)\\b/gi, suggestion: 'Consider using {cleaning_level} variable' },
      { pattern: /User:|Lumen:/gi, suggestion: 'Consider using {conversation_context} for speaker context' }
    ]
    
    hardcodedPatterns.forEach(({ pattern, suggestion }) => {
      if (pattern.test(template)) {
        warnings.push({
          field: 'template',
          type: 'unused_variable',
          message: 'Potential hardcoded value detected',
          suggestion
        })
      }
    })
    
    return warnings
  }

  // Generate helpful suggestions
  private generateSuggestions(template: string): string[] {
    const suggestions: string[] = []
    
    // Suggest variable usage
    const detectedVars = this.extractVariables(template)
    const unusedOptionalVars = Object.entries(SUPPORTED_VARIABLES)
      .filter(([name, config]) => !config.required && !detectedVars.includes(name))
      .map(([name, _]) => name)
    
    if (unusedOptionalVars.length > 0) {
      suggestions.push(`Consider adding optional variables: ${unusedOptionalVars.join(', ')}`)
    }
    
    // Suggest improvements based on template content
    if (!template.includes('JSON')) {
      suggestions.push('Consider specifying the expected output format (e.g., JSON)')
    }
    
    if (!template.includes('example')) {
      suggestions.push('Adding examples can improve AI performance')
    }
    
    return suggestions
  }

  // Real-time validation for input fields
  validateField(
    field: 'name' | 'template' | 'description',
    value: string,
    currentTemplateId?: string
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    switch (field) {
      case 'name':
        return this.validateTemplateName(value, currentTemplateId)
      case 'template':
        const templateResult = this.validateTemplateContent(value)
        return { 
          errors: templateResult.errors || [], 
          warnings: templateResult.warnings || [] 
        }
      case 'description':
        const descResult = this.validateDescription(value)
        return { errors: [], warnings: descResult.warnings }
      default:
        return { errors: [], warnings: [] }
    }
  }

  // Get variable suggestions based on current template
  getVariableSuggestions(template: string): VariableSuggestion[] {
    const detectedVars = this.extractVariables(template)
    const suggestions: VariableSuggestion[] = []
    
    // Add missing required variables
    Object.entries(SUPPORTED_VARIABLES)
      .filter(([name, config]) => config.required && !detectedVars.includes(name))
      .forEach(([name, config]) => {
        suggestions.push({
          name,
          type: 'detected',
          description: config.description
        })
      })
    
    // Add optional variables that might be useful
    Object.entries(SUPPORTED_VARIABLES)
      .filter(([name, config]) => !config.required && !detectedVars.includes(name))
      .forEach(([name, config]) => {
        suggestions.push({
          name,
          type: 'recommended',
          description: config.description
        })
      })
    
    return suggestions
  }
}

// Utility function to format validation messages for display
export function formatValidationMessage(error: ValidationError | ValidationWarning): string {
  // Safety check for malformed error objects
  if (!error || typeof error !== 'object') {
    console.warn('Invalid validation error object:', error)
    return 'Invalid validation error'
  }
  
  if (!error.message) {
    console.warn('Validation error missing message:', error)
    return 'Validation error (no message provided)'
  }
  
  let message = error.message
  
  if ('line' in error && error.line) {
    message += ` (line ${error.line}`
    if (error.column) {
      message += `, column ${error.column}`
    }
    message += ')'
  }
  
  if (error.suggestion) {
    message += `. ${error.suggestion}`
  }
  
  return message
}

// Utility to create validator instance
export function createTemplateValidator(existingTemplates: Array<{ id: string; name: string }>) {
  return new TemplateValidator(existingTemplates)
}