import { useState, useEffect, createContext, useContext, useCallback } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  actions?: Array<{
    label: string
    action: () => void
    style?: 'primary' | 'secondary'
  }>
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void
  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string) => void
  showWarning: (title: string, message?: string) => void
  showInfo: (title: string, message?: string) => void
  dismissToast: (id: string) => void
  clearAll: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
  theme?: any
  maxToasts?: number
  defaultDuration?: number
}

export function ToastProvider({ 
  children, 
  theme, 
  maxToasts = 5, 
  defaultDuration = 5000 
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? defaultDuration
    }

    setToasts(prev => {
      const updated = [newToast, ...prev]
      return updated.slice(0, maxToasts)
    })

    // Auto-dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }
  }, [maxToasts, defaultDuration])

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast({ type: 'success', title, message })
  }, [showToast])

  const showError = useCallback((title: string, message?: string) => {
    showToast({ type: 'error', title, message, duration: 0 }) // Don't auto-dismiss errors
  }, [showToast])

  const showWarning = useCallback((title: string, message?: string) => {
    showToast({ type: 'warning', title, message })
  }, [showToast])

  const showInfo = useCallback((title: string, message?: string) => {
    showToast({ type: 'info', title, message })
  }, [showToast])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    clearAll
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} theme={theme} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
  theme?: any
}

function ToastContainer({ toasts, onDismiss, theme }: ToastContainerProps) {
  if (toasts.length === 0) return null

  const defaultTheme = {
    bg: '#ffffff',
    text: '#111827',
    textSecondary: '#374151',
    border: '#e5e7eb',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }

  const currentTheme = theme || defaultTheme

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '400px',
        width: '100%'
      }}
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          theme={currentTheme}
        />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
  theme: any
}

function ToastItem({ toast, onDismiss, theme }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const getToastColors = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: theme.success + '20',
          border: theme.success,
          icon: '✅',
          iconColor: theme.success
        }
      case 'error':
        return {
          bg: theme.error + '20',
          border: theme.error,
          icon: '❌',
          iconColor: theme.error
        }
      case 'warning':
        return {
          bg: theme.warning + '20',
          border: theme.warning,
          icon: '⚠️',
          iconColor: theme.warning
        }
      case 'info':
        return {
          bg: theme.info + '20',
          border: theme.info,
          icon: 'ℹ️',
          iconColor: theme.info
        }
      default:
        return {
          bg: theme.bg,
          border: theme.border,
          icon: 'ℹ️',
          iconColor: theme.textSecondary
        }
    }
  }

  const colors = getToastColors(toast.type)

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transform: isLeaving ? 'translateX(100%)' : (isVisible ? 'translateX(0)' : 'translateX(100%)'),
        opacity: isLeaving ? 0 : (isVisible ? 1 : 0),
        transition: 'all 0.3s ease-in-out',
        minWidth: '300px'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        {/* Icon */}
        <div style={{
          fontSize: '20px',
          flexShrink: 0,
          marginTop: '2px'
        }}>
          {colors.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: theme.text,
            marginBottom: toast.message ? '4px' : '0'
          }}>
            {toast.title}
          </div>
          
          {toast.message && (
            <div style={{
              fontSize: '13px',
              color: theme.textSecondary,
              lineHeight: '1.4',
              marginBottom: toast.actions ? '12px' : '0'
            }}>
              {toast.message}
            </div>
          )}

          {/* Actions */}
          {toast.actions && toast.actions.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px'
            }}>
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.action()
                    handleDismiss()
                  }}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: action.style === 'primary' ? colors.iconColor : 'transparent',
                    color: action.style === 'primary' ? 'white' : colors.iconColor,
                    border: `1px solid ${colors.iconColor}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: theme.textSecondary,
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            flexShrink: 0
          }}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          backgroundColor: colors.border,
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              height: '100%',
              backgroundColor: colors.iconColor,
              width: '100%',
              animation: `toast-progress ${toast.duration}ms linear forwards`
            }}
          />
        </div>
      )}

      <style>
        {`
          @keyframes toast-progress {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}
      </style>
    </div>
  )
}

// Utility hook for template-specific toasts
export function useTemplateToasts() {
  const toast = useToast()

  const showValidationError = useCallback((errors: string[]) => {
    toast.showError(
      'Validation Failed',
      errors.length === 1 ? errors[0] : `${errors.length} validation errors found`
    )
  }, [toast])

  const showSaveSuccess = useCallback((templateName: string) => {
    toast.showSuccess('Template Saved', `"${templateName}" has been saved successfully`)
  }, [toast])

  const showDeleteSuccess = useCallback((templateName: string) => {
    toast.showSuccess('Template Deleted', `"${templateName}" has been deleted`)
  }, [toast])

  const showDuplicateSuccess = useCallback((originalName: string, newName: string) => {
    toast.showSuccess('Template Duplicated', `"${originalName}" duplicated as "${newName}"`)
  }, [toast])

  const showActivateSuccess = useCallback((templateName: string) => {
    toast.showSuccess('Template Activated', `"${templateName}" is now the active template`)
  }, [toast])

  const showApiError = useCallback((operation: string, error: string) => {
    toast.showError(
      `${operation} Failed`,
      error || 'An unexpected error occurred. Please try again.'
    )
  }, [toast])

  const showNetworkError = useCallback(() => {
    toast.showToast({
      type: 'error',
      title: 'Network Error',
      message: 'Unable to connect to the server. Please check your connection.',
      duration: 0,
      actions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          style: 'primary'
        }
      ]
    })
  }, [toast])

  return {
    showValidationError,
    showSaveSuccess,
    showDeleteSuccess,
    showDuplicateSuccess,
    showActivateSuccess,
    showApiError,
    showNetworkError
  }
}