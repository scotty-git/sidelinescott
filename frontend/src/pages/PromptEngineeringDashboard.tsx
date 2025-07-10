import React, { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

// Monaco Editor for code editing
import Editor from '@monaco-editor/react'

interface PromptTemplate {
  id: string
  name: string
  template: string
  description?: string
  variables: string[]
  version: string
  is_active: boolean
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

export function PromptEngineeringDashboard() {
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

  // Theme
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('prompt-dashboard-dark-mode')
    return saved ? JSON.parse(saved) : true
  })

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

  useEffect(() => {
    localStorage.setItem('prompt-dashboard-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/v1/prompt-engineering/templates')
      setTemplates(response)
      
      // Find active template
      const active = response.find((t: PromptTemplate) => t.is_active)
      if (active) {
        setActiveTemplate(active)
        setEditingTemplate(active.template)
        setTemplateName(active.name)
        setTemplateDescription(active.description || '')
      }
    } catch (err) {
      setError(`Failed to load templates: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const renderPreview = async () => {
    if (!activeTemplate) return

    try {
      const response = await apiClient.post(`/api/v1/prompt-engineering/templates/${activeTemplate.id}/render`, {
        template_id: activeTemplate.id,
        variables: previewVariables
      })
      setRenderedPreview(response)
    } catch (err) {
      setError(`Failed to render preview: ${err}`)
    }
  }

  const saveTemplate = async () => {
    if (!activeTemplate) return

    try {
      setLoading(true)
      await apiClient.put(`/api/v1/prompt-engineering/templates/${activeTemplate.id}`, {
        name: templateName,
        template: editingTemplate,
        description: templateDescription
      })
      
      await loadTemplates()
      setError(null)
    } catch (err) {
      setError(`Failed to save template: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const createNewTemplate = async () => {
    try {
      setLoading(true)
      const response = await apiClient.post('/api/v1/prompt-engineering/templates', {
        name: `New Template ${Date.now()}`,
        template: 'Your prompt template here with {variables}',
        description: 'New template description',
        variables: ['variables']
      })
      
      await loadTemplates()
      setError(null)
    } catch (err) {
      setError(`Failed to create template: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const activateTemplate = async (templateId: string) => {
    try {
      await apiClient.post(`/api/v1/prompt-engineering/templates/${templateId}/activate`)
      await loadTemplates()
    } catch (err) {
      setError(`Failed to activate template: ${err}`)
    }
  }

  const analyzeTurn = async () => {
    if (!selectedTurnId) return

    try {
      setLoading(true)
      const response = await apiClient.get(`/api/v1/prompt-engineering/turns/${selectedTurnId}/prompt-analysis`)
      setTurnAnalysis(response)
    } catch (err) {
      setError(`Failed to analyze turn: ${err}`)
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
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              🔧 Prompt Engineering Dashboard
            </h1>
            <p style={{ margin: '4px 0 0 0', color: theme.textMuted }}>
              Full visibility and control over AI cleaning prompts
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <h3 style={{ margin: 0 }}>Prompt Template Editor</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                    onClick={saveTemplate}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: theme.success,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    💾 Save
                  </button>
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
                    onChange={(e) => setTemplateName(e.target.value)}
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
                    onChange={(e) => setTemplateDescription(e.target.value)}
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
                  onChange={(value) => setEditingTemplate(value || '')}
                  theme={darkMode ? 'vs-dark' : 'light'}
                  options={{
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    lineNumbers: 'on',
                    folding: true,
                    bracketMatching: 'always'
                  }}
                />
              </div>

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
              
              {/* Variable Values */}
              <div style={{ 
                backgroundColor: theme.bgSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                padding: '16px'
              }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Preview Variables</h4>
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
              </div>

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
                      backgroundColor: template.is_active ? theme.accent + '20' : theme.bg,
                      border: `1px solid ${template.is_active ? theme.accent : theme.border}`,
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
                        {template.is_active && (
                          <span style={{ 
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: theme.success,
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '10px'
                          }}>
                            ACTIVE
                          </span>
                        )}
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
                      {!template.is_active && (
                        <button
                          onClick={() => activateTemplate(template.id)}
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
                          ⚡ Activate
                        </button>
                      )}
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
    </div>
  )
}