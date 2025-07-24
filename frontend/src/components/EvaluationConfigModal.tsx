import React from 'react'

interface EvaluationConfig {
  evaluation: {
    id: string
    name: string
    description?: string
    created_at: string
  }
  cleanerConfig: {
    templateName: string
    templateDescription?: string
    slidingWindow: number
    cleaningLevel: string
    modelName: string
    temperature: number
    topP: number
    topK: number
    maxTokens: number
  }
  functionConfig: {
    templateName: string
    templateDescription?: string
    slidingWindow: number
    modelName: string
    temperature: number
    topP: number
    topK: number
    maxTokens: number
  }
}

interface EvaluationConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  config: EvaluationConfig | null
  theme: any
}

export function EvaluationConfigModal({ isOpen, onClose, onConfirm, config, theme }: EvaluationConfigModalProps) {
  if (!isOpen || !config) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: theme.bg,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
        maxWidth: '900px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Confirm Evaluation Settings
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: theme.textMuted, 
              marginTop: '4px' 
            }}>
              Review the configuration below before starting the evaluation.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.textMuted,
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.bgTertiary
              e.currentTarget.style.color = theme.text
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.textMuted
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          overflow: 'auto',
          flex: 1
        }}>
          {/* Two-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px'
          }}>
            {/* Left Column - Cleaner Config */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.success
                }}></div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: theme.text
                }}>
                  Cleaner Configuration
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Template Info */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '4px'
                  }}>
                    PROMPT TEMPLATE
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: theme.text,
                    marginBottom: '2px'
                  }}>
                    {config.cleanerConfig.templateName}
                  </div>
                  {config.cleanerConfig.templateDescription && (
                    <div style={{
                      fontSize: '12px',
                      color: theme.textMuted
                    }}>
                      {config.cleanerConfig.templateDescription}
                    </div>
                  )}
                </div>

                {/* Window Settings */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '8px'
                  }}>
                    CONTEXT WINDOW
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: theme.accent
                    }}>
                      {config.cleanerConfig.slidingWindow}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: theme.textSecondary
                    }}>
                      turns
                    </div>
                  </div>
                </div>

                {/* Model Settings */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '8px'
                  }}>
                    MODEL CONFIGURATION
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Model:</span>
                      <span style={{ fontSize: '13px', color: theme.text, fontFamily: 'monospace' }}>
                        {config.cleanerConfig.modelName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Cleaning Level:</span>
                      <span style={{ fontSize: '13px', color: theme.text, textTransform: 'capitalize' }}>
                        {config.cleanerConfig.cleaningLevel}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Temperature:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.cleanerConfig.temperature}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Top P:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.cleanerConfig.topP}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Top K:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.cleanerConfig.topK}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Max Tokens:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.cleanerConfig.maxTokens}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Function Config */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.warning
                }}></div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: theme.text
                }}>
                  Function Caller Configuration
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Template Info */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '4px'
                  }}>
                    PROMPT TEMPLATE
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: theme.text,
                    marginBottom: '2px'
                  }}>
                    {config.functionConfig.templateName}
                  </div>
                  {config.functionConfig.templateDescription && (
                    <div style={{
                      fontSize: '12px',
                      color: theme.textMuted
                    }}>
                      {config.functionConfig.templateDescription}
                    </div>
                  )}
                </div>

                {/* Window Settings */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '8px'
                  }}>
                    CONTEXT WINDOW
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: theme.accent
                    }}>
                      {config.functionConfig.slidingWindow}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: theme.textSecondary
                    }}>
                      turns
                    </div>
                  </div>
                </div>

                {/* Model Settings */}
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: theme.textMuted,
                    marginBottom: '8px'
                  }}>
                    MODEL CONFIGURATION
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Model:</span>
                      <span style={{ fontSize: '13px', color: theme.text, fontFamily: 'monospace' }}>
                        {config.functionConfig.modelName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Temperature:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.functionConfig.temperature}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Top P:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.functionConfig.topP}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Top K:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.functionConfig.topK}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: theme.textSecondary }}>Max Tokens:</span>
                      <span style={{ fontSize: '13px', color: theme.text }}>
                        {config.functionConfig.maxTokens}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer with buttons */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: theme.bgSecondary
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              backgroundColor: theme.bgTertiary,
              color: theme.text,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: theme.accent,
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Confirm & Start Evaluation
          </button>
        </div>
      </div>
    </div>
  )
}