import { useState, useEffect, useMemo } from 'react'

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

interface TemplateLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  templates: PromptTemplate[]
  onEdit: (template: PromptTemplate) => void
  onDelete: (templateId: string) => void
  onDuplicate: (template: PromptTemplate) => void
  onBulkAction: (action: string, templateIds: string[]) => void
  loading?: boolean
  theme: any
}

export function TemplateLibraryModal({
  isOpen,
  onClose,
  templates,
  onEdit,
  onDelete,
  onDuplicate,
  onBulkAction,
  loading = false,
  theme
}: TemplateLibraryModalProps) {
  // State management
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'recent'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created' | 'usage'>('updated')
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

  // Filter and search logic
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = templates.filter(template => {
      // Search filter
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.variables.some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
      
      if (!matchesSearch) return false

      // Status filter
      switch (filterBy) {
        case 'recent':
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          return new Date(template.updated_at) > sevenDaysAgo
        default:
          return true
      }
    })

    // Sort logic
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'usage':
          // TODO: Implement usage-based sorting when usage data is available
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return filtered
  }, [templates, searchQuery, filterBy, sortBy])

  // Handlers
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    )
  }

  const handleSelectAll = () => {
    if (selectedTemplates.length === filteredAndSortedTemplates.length) {
      setSelectedTemplates([])
    } else {
      setSelectedTemplates(filteredAndSortedTemplates.map(t => t.id))
    }
  }

  const handleDeleteTemplate = (templateId: string) => {
    setTemplateToDelete(templateId)
    setShowConfirmDelete(true)
  }

  const confirmDelete = () => {
    if (templateToDelete) {
      onDelete(templateToDelete)
      setTemplateToDelete(null)
      setShowConfirmDelete(false)
    }
  }

  const handleBulkDelete = () => {
    if (selectedTemplates.length > 0) {
      onBulkAction('delete', selectedTemplates)
      setSelectedTemplates([])
    }
  }


  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplates([])
      setSearchQuery('')
      setHoveredTemplate(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div 
          style={{
            backgroundColor: theme.bg,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '24px', 
                fontWeight: '600',
                color: theme.text 
              }}>
                📚 Template Library
              </h2>
              <p style={{ 
                margin: '4px 0 0 0', 
                color: theme.textMuted,
                fontSize: '14px' 
              }}>
                Manage and organize your prompt templates
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: theme.textMuted,
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Controls Bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  color: theme.text,
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Filters */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.bgSecondary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                fontSize: '14px'
              }}
            >
              <option value="all">All Templates</option>
              <option value="recent">Recent (7 days)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.bgSecondary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                fontSize: '14px'
              }}
            >
              <option value="updated">Last Updated</option>
              <option value="name">Name A-Z</option>
              <option value="created">Date Created</option>
              <option value="usage">Usage Count</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'grid' ? theme.accent : theme.bgSecondary,
                  color: viewMode === 'grid' ? 'white' : theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px 0 0 6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⊞ Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'list' ? theme.accent : theme.bgSecondary,
                  color: viewMode === 'list' ? 'white' : theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '0 6px 6px 0',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ☰ List
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedTemplates.length > 0 && (
            <div style={{
              padding: '12px 24px',
              backgroundColor: theme.bgSecondary,
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '14px', color: theme.text }}>
                {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleBulkDelete}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.error,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: theme.textMuted
              }}>
                Loading templates...
              </div>
            ) : filteredAndSortedTemplates.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: theme.textMuted
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>No templates found</div>
                <div style={{ fontSize: '14px' }}>
                  {searchQuery ? 'Try adjusting your search or filters' : 'Create your first template to get started'}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {filteredAndSortedTemplates.map(template => (
                  <div
                    key={template.id}
                    style={{
                      backgroundColor: theme.bgSecondary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      transform: hoveredTemplate === template.id ? 'translateY(-2px)' : 'none',
                      boxShadow: hoveredTemplate === template.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                    }}
                    onMouseEnter={() => setHoveredTemplate(template.id)}
                    onMouseLeave={() => setHoveredTemplate(null)}
                  >
                    {/* Template Card Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedTemplates.includes(template.id)}
                            onChange={() => handleSelectTemplate(template.id)}
                            style={{ margin: 0 }}
                          />
                          <h4 style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: theme.text
                          }}>
                            {template.name}
                          </h4>
                        </div>
                        {template.description && (
                          <p style={{
                            margin: 0,
                            fontSize: '12px',
                            color: theme.textMuted,
                            lineHeight: '1.4'
                          }}>
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Template Stats */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px',
                      fontSize: '12px',
                      color: theme.textMuted
                    }}>
                      <span>📄 v{template.version}</span>
                      <span>🔧 {template.variables.length} vars</span>
                      <span>📅 {new Date(template.updated_at).toLocaleDateString()}</span>
                    </div>

                    {/* Variables Preview */}
                    <div style={{
                      marginBottom: '12px',
                      fontSize: '11px',
                      color: theme.textMuted
                    }}>
                      <strong>Variables:</strong> {template.variables.join(', ') || 'None'}
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => onEdit(template)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: theme.bgTertiary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => onDuplicate(template)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: theme.bgTertiary,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        📄 Duplicate
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: theme.error,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div style={{
                backgroundColor: theme.bgSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden'
              }}>
                {/* List Header */}
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: theme.bgTertiary,
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 100px 120px 180px',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: theme.textMuted
                }}>
                  <input
                    type="checkbox"
                    checked={selectedTemplates.length === filteredAndSortedTemplates.length && filteredAndSortedTemplates.length > 0}
                    onChange={handleSelectAll}
                  />
                  <span>NAME</span>
                  <span>VERSION</span>
                  <span>VARIABLES</span>
                  <span>ACTIONS</span>
                </div>

                {/* List Items */}
                {filteredAndSortedTemplates.map(template => (
                  <div
                    key={template.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${theme.border}`,
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 100px 120px 180px',
                      gap: '12px',
                      alignItems: 'center',
                      fontSize: '14px',
                      backgroundColor: hoveredTemplate === template.id ? theme.bgTertiary : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={() => setHoveredTemplate(template.id)}
                    onMouseLeave={() => setHoveredTemplate(null)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTemplates.includes(template.id)}
                      onChange={() => handleSelectTemplate(template.id)}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: theme.text }}>
                        {template.name}
                      </div>
                      {template.description && (
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                          {template.description}
                        </div>
                      )}
                    </div>
                    <span style={{ color: theme.textMuted }}>v{template.version}</span>
                    <span style={{ color: theme.textMuted }}>{template.variables.length}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => onEdit(template)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDuplicate(template)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        📄
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: theme.error,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '14px', color: theme.textMuted }}>
              Showing {filteredAndSortedTemplates.length} of {templates.length} templates
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.bgSecondary,
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
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: theme.bg,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: theme.text,
              fontSize: '18px'
            }}>
              ⚠️ Confirm Deletion
            </h3>
            <p style={{ 
              margin: '0 0 20px 0', 
              color: theme.textSecondary,
              lineHeight: '1.5'
            }}>
              Are you sure you want to delete this template? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmDelete(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  color: theme.text,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.error,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}