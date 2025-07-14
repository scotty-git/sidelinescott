# Template Library Modal Component Design Document

## Overview

The Template Library Modal is a comprehensive interface for managing prompt templates within the Lumen Transcript Cleaner's Prompt Engineering Dashboard. This modal provides full CRUD operations, bulk actions, and advanced filtering capabilities while maintaining seamless integration with the existing design system.

## Component Structure & Props Interface

### Core Component Props

```typescript
interface TemplateLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate?: (template: PromptTemplate) => void
  mode: 'manage' | 'select' | 'bulk'
  selectedTemplateId?: string
  allowMultiSelect?: boolean
  showSystemTemplates?: boolean
  theme: Theme
}

interface TemplateLibraryModalState {
  templates: PromptTemplate[]
  filteredTemplates: PromptTemplate[]
  selectedTemplates: Set<string>
  loading: boolean
  error: string | null
  
  // View & UI State
  viewMode: 'grid' | 'list'
  searchQuery: string
  sortBy: 'name' | 'created_at' | 'updated_at' | 'version'
  sortOrder: 'asc' | 'desc'
  filterBy: {
    status: 'all' | 'active' | 'inactive'
    category: 'all' | 'user' | 'system'
    version: string | null
  }
  
  // Modal States
  showPreview: boolean
  previewTemplate: PromptTemplate | null
  showDeleteConfirmation: boolean
  deletingTemplates: string[]
  bulkAction: 'activate' | 'deactivate' | 'delete' | 'duplicate' | null
}
```

### Extended Template Interface

```typescript
interface PromptTemplate {
  id: string
  name: string
  template: string
  description?: string
  variables: string[]
  version: string
  is_active: boolean
  is_system: boolean
  category: string
  tags: string[]
  created_at: string
  updated_at: string
  usage_count: number
  last_used: string | null
  token_count: number
  performance_score: number
}
```

## State Management Approach

### Custom Hook: useTemplateLibrary

```typescript
const useTemplateLibrary = (initialFilters?: FilterState) => {
  const [state, setState] = useState<TemplateLibraryModalState>({
    templates: [],
    filteredTemplates: [],
    selectedTemplates: new Set(),
    loading: false,
    error: null,
    viewMode: 'grid',
    searchQuery: '',
    sortBy: 'updated_at',
    sortOrder: 'desc',
    filterBy: {
      status: 'all',
      category: 'all',
      version: null
    },
    showPreview: false,
    previewTemplate: null,
    showDeleteConfirmation: false,
    deletingTemplates: [],
    bulkAction: null
  })

  // Actions
  const loadTemplates = async () => { /* Implementation */ }
  const searchTemplates = (query: string) => { /* Implementation */ }
  const sortTemplates = (field: string, order: 'asc' | 'desc') => { /* Implementation */ }
  const filterTemplates = (filters: FilterState) => { /* Implementation */ }
  const selectTemplate = (templateId: string) => { /* Implementation */ }
  const bulkSelectTemplates = (templateIds: string[]) => { /* Implementation */ }
  const performBulkAction = (action: BulkAction) => { /* Implementation */ }
  
  return {
    state,
    actions: {
      loadTemplates,
      searchTemplates,
      sortTemplates,
      filterTemplates,
      selectTemplate,
      bulkSelectTemplates,
      performBulkAction
    }
  }
}
```

## UI Layout & Component Architecture

### Desktop Layout (1200px+)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Template Library                                       │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │  🔍 Search    📊 Sort    🔽 Filter    👁️ View    [Selected: 0]    ✕ Close    │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ ┌─────────────────────────────┬─────────────────────────────────────────────────┐ │
│ │         Filters             │              Templates                          │ │
│ │  ┌─────────────────────────┐│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │ │
│ │  │ Status                  ││  │ T1  │ │ T2  │ │ T3  │ │ T4  │ │ T5  │       │ │
│ │  │ ○ All                   ││  │     │ │     │ │     │ │     │ │     │       │ │
│ │  │ ○ Active                ││  │     │ │     │ │     │ │     │ │     │       │ │
│ │  │ ○ Inactive              ││  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │ │
│ │  │                         ││                                                 │ │
│ │  │ Category                ││  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │ │
│ │  │ ○ All                   ││  │ T6  │ │ T7  │ │ T8  │ │ T9  │ │ T10 │       │ │
│ │  │ ○ User                  ││  │     │ │     │ │     │ │     │ │     │       │ │
│ │  │ ○ System                ││  │     │ │     │ │     │ │     │ │     │       │ │
│ │  │                         ││  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │ │
│ │  │ Quick Actions           ││                                                 │ │
│ │  │ [+ New Template]        ││                                                 │ │
│ │  │ [📤 Import]             ││                                                 │ │
│ │  │ [📥 Export]             ││                                                 │ │
│ │  └─────────────────────────┘│                                                 │ │
│ └─────────────────────────────┴─────────────────────────────────────────────────┘ │
│                                                                                     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │  Bulk Actions: [✓ Activate] [✕ Deactivate] [📋 Duplicate] [🗑️ Delete]        │ │
│ │                                               [Cancel] [Apply to 0 selected]  │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 768px)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Template Library                                       │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │  🔍 Search [🔽] [📊] [👁️]                                           ✕ Close    │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │  📋 Template Name A                                    ✓ Active    [Select]   │ │
│ │  📝 Clean transcript errors and formatting...                                 │ │
│ │  🏷️ v1.2.0 | 📊 Usage: 245 | 📅 Updated: 2 days ago                           │ │
│ │  ───────────────────────────────────────────────────────────────────────────── │ │
│ │  📋 Template Name B                                    ✕ Inactive  [Select]   │ │
│ │  📝 Advanced cleaning with context awareness...                               │ │
│ │  🏷️ v2.0.0 | 📊 Usage: 12 | 📅 Updated: 1 week ago                            │ │
│ │  ───────────────────────────────────────────────────────────────────────────── │ │
│ │  📋 Template Name C                                    ✓ Active    [Select]   │ │
│ │  📝 Minimal cleaning for technical content...                                 │ │
│ │  🏷️ v1.0.0 | 📊 Usage: 78 | 📅 Updated: 3 days ago                            │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │  [+ New Template] [📤 Import] [📥 Export]                                      │ │
│ │                                                                                │ │
│ │  Selected: 0 templates                                                        │ │
│ │  [✓ Activate] [✕ Deactivate] [📋 Duplicate] [🗑️ Delete]                        │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Template Card Components

### Grid View Template Card

```typescript
const TemplateCard: React.FC<{
  template: PromptTemplate
  selected: boolean
  onSelect: (id: string) => void
  onPreview: (template: PromptTemplate) => void
  onEdit: (template: PromptTemplate) => void
  onDelete: (id: string) => void
  theme: Theme
}> = ({ template, selected, onSelect, onPreview, onEdit, onDelete, theme }) => {
  return (
    <div style={{
      backgroundColor: selected ? `${theme.accent}20` : theme.bgSecondary,
      border: `1px solid ${selected ? theme.accent : theme.border}`,
      borderRadius: '8px',
      padding: '16px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      position: 'relative',
      minHeight: '200px'
    }}>
      {/* Selection Checkbox */}
      <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(template.id)}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Status Indicator */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: template.is_active ? theme.success : theme.textMuted
      }} />

      {/* Template Info */}
      <div style={{ marginTop: '24px' }}>
        <h4 style={{ 
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: theme.text
        }}>
          {template.name}
        </h4>
        
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '12px',
          color: theme.textMuted,
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {template.description || 'No description provided'}
        </p>

        {/* Metadata */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '11px',
          color: theme.textMuted
        }}>
          <span>v{template.version}</span>
          <span>•</span>
          <span>{template.variables.length} vars</span>
          <span>•</span>
          <span>{template.usage_count} uses</span>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPreview(template)
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              color: theme.text,
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            👁️ Preview
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(template)
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              color: theme.text,
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            ✏️ Edit
          </button>
          
          {!template.is_system && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(template.id)
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: `${theme.error}20`,
                border: `1px solid ${theme.error}`,
                borderRadius: '4px',
                color: theme.error,
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### List View Template Row

```typescript
const TemplateRow: React.FC<{
  template: PromptTemplate
  selected: boolean
  onSelect: (id: string) => void
  onPreview: (template: PromptTemplate) => void
  onEdit: (template: PromptTemplate) => void
  onDelete: (id: string) => void
  theme: Theme
}> = ({ template, selected, onSelect, onPreview, onEdit, onDelete, theme }) => {
  return (
    <div style={{
      backgroundColor: selected ? `${theme.accent}20` : 'transparent',
      border: `1px solid ${selected ? theme.accent : theme.border}`,
      borderRadius: '4px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      cursor: 'pointer',
      transition: 'all 0.15s ease'
    }}>
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(template.id)}
        style={{ cursor: 'pointer' }}
      />

      {/* Status Indicator */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: template.is_active ? theme.success : theme.textMuted,
        flexShrink: 0
      }} />

      {/* Template Name & Description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: theme.text,
          marginBottom: '4px'
        }}>
          {template.name}
          {template.is_system && (
            <span style={{
              marginLeft: '8px',
              padding: '2px 6px',
              backgroundColor: theme.accent,
              color: 'white',
              borderRadius: '4px',
              fontSize: '10px'
            }}>
              SYSTEM
            </span>
          )}
        </div>
        <div style={{
          fontSize: '12px',
          color: theme.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {template.description || 'No description provided'}
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
        fontSize: '11px',
        color: theme.textMuted,
        minWidth: '120px'
      }}>
        <span>v{template.version}</span>
        <span>{template.usage_count} uses</span>
        <span>{new Date(template.updated_at).toLocaleDateString()}</span>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexShrink: 0
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPreview(template)
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: theme.bgTertiary,
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            color: theme.text,
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          👁️ Preview
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(template)
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: theme.bgTertiary,
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            color: theme.text,
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          ✏️ Edit
        </button>
        
        {!template.is_system && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(template.id)
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: `${theme.error}20`,
              border: `1px solid ${theme.error}`,
              borderRadius: '4px',
              color: theme.error,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  )
}
```

## User Interaction Flows

### 1. Template Selection Flow

```
User Opens Modal
    ↓
Load Templates → Display in Grid/List
    ↓
User Searches/Filters
    ↓
User Selects Template(s)
    ↓
[Single Select] → Preview & Confirm Selection
[Multi Select] → Review Selected Templates
    ↓
User Confirms Selection
    ↓
Modal Closes & Returns Selected Template(s)
```

### 2. Template Management Flow

```
User Opens Modal in Management Mode
    ↓
Display All Templates with Management Controls
    ↓
User Performs Action:
├── Create New Template → Template Editor Modal
├── Edit Template → Template Editor Modal
├── Delete Template → Confirmation Dialog
├── Duplicate Template → Create Copy with "(Copy)" suffix
├── Activate/Deactivate → Immediate Action with Feedback
└── Bulk Actions → Bulk Confirmation Dialog
    ↓
Action Completed → Update Template List
    ↓
Show Success Feedback
```

### 3. Search & Filter Flow

```
User Enters Search Query
    ↓
Debounced Search (300ms) → Filter Templates by Name/Description
    ↓
User Applies Filters
    ↓
Combine Search + Filters + Sort → Update Displayed Templates
    ↓
Show Results Count & Clear Filters Option
```

### 4. Bulk Operations Flow

```
User Selects Multiple Templates
    ↓
Bulk Action Bar Appears
    ↓
User Selects Bulk Action
    ↓
Confirmation Dialog Shows:
├── Action Details
├── Affected Templates List
├── Potential Impact Warning
└── Cancel/Confirm Options
    ↓
User Confirms → Execute Bulk Action
    ↓
Progress Indicator → Success/Error Feedback
```

## Advanced Features

### Template Preview Modal

```typescript
const TemplatePreviewModal: React.FC<{
  template: PromptTemplate
  isOpen: boolean
  onClose: () => void
  onEdit: (template: PromptTemplate) => void
  theme: Theme
}> = ({ template, isOpen, onClose, onEdit, theme }) => {
  const [renderedPrompt, setRenderedPrompt] = useState<string>('')
  const [sampleVariables, setSampleVariables] = useState<Record<string, string>>({})

  // Render preview with sample variables
  const renderPreview = async () => {
    // Implementation for rendering prompt with sample data
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <div style={{ padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px' }}>
            Template Preview: {template.name}
          </h3>
          <button
            onClick={() => onEdit(template)}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ✏️ Edit Template
          </button>
        </div>

        {/* Template Metadata */}
        <div style={{
          backgroundColor: theme.bgSecondary,
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <strong>Version:</strong> {template.version}
            </div>
            <div>
              <strong>Status:</strong> {template.is_active ? 'Active' : 'Inactive'}
            </div>
            <div>
              <strong>Usage:</strong> {template.usage_count} times
            </div>
            <div>
              <strong>Last Updated:</strong> {new Date(template.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Variables Configuration */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>Sample Variables</h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            {template.variables.map((variable) => (
              <div key={variable}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
                  {variable}
                </label>
                <input
                  type="text"
                  value={sampleVariables[variable] || ''}
                  onChange={(e) => setSampleVariables({ ...sampleVariables, [variable]: e.target.value })}
                  placeholder={`Enter sample value for ${variable}`}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    color: theme.text
                  }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={renderPreview}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: theme.success,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Render Preview
          </button>
        </div>

        {/* Rendered Preview */}
        {renderedPrompt && (
          <div>
            <h4 style={{ marginBottom: '16px' }}>Rendered Prompt</h4>
            <div style={{
              backgroundColor: theme.bgTertiary,
              padding: '16px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {renderedPrompt}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
```

### Bulk Action Confirmation Dialog

```typescript
const BulkActionConfirmationDialog: React.FC<{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  action: BulkAction
  selectedTemplates: PromptTemplate[]
  theme: Theme
}> = ({ isOpen, onClose, onConfirm, action, selectedTemplates, theme }) => {
  const getActionDetails = () => {
    switch (action) {
      case 'delete':
        return {
          title: 'Delete Templates',
          message: 'Are you sure you want to delete the selected templates? This action cannot be undone.',
          icon: '🗑️',
          color: theme.error,
          warnings: selectedTemplates.filter(t => t.is_active).length > 0 
            ? ['Some selected templates are currently active and will be deactivated.']
            : []
        }
      case 'activate':
        return {
          title: 'Activate Templates',
          message: 'The selected templates will be activated and available for use.',
          icon: '✅',
          color: theme.success,
          warnings: selectedTemplates.length > 1 
            ? ['Multiple templates will be active. Only one can be the primary template.']
            : []
        }
      case 'deactivate':
        return {
          title: 'Deactivate Templates',
          message: 'The selected templates will be deactivated and unavailable for use.',
          icon: '⏸️',
          color: theme.warning,
          warnings: selectedTemplates.filter(t => t.is_active).length > 0
            ? ['Active templates will be deactivated. Make sure you have another template ready.']
            : []
        }
      case 'duplicate':
        return {
          title: 'Duplicate Templates',
          message: 'Copies of the selected templates will be created with "(Copy)" suffix.',
          icon: '📋',
          color: theme.accent,
          warnings: []
        }
      default:
        return {
          title: 'Bulk Action',
          message: 'Perform bulk action on selected templates.',
          icon: '⚙️',
          color: theme.accent,
          warnings: []
        }
    }
  }

  const details = getActionDetails()

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <div style={{ padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '24px' }}>{details.icon}</div>
          <h3 style={{ margin: 0, fontSize: '18px' }}>{details.title}</h3>
        </div>

        <p style={{ marginBottom: '20px', color: theme.textSecondary }}>
          {details.message}
        </p>

        {details.warnings.length > 0 && (
          <div style={{
            backgroundColor: `${theme.warning}20`,
            border: `1px solid ${theme.warning}`,
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ fontWeight: '600', color: theme.warning, marginBottom: '8px' }}>
              ⚠️ Warnings:
            </div>
            {details.warnings.map((warning, index) => (
              <div key={index} style={{ fontSize: '12px', color: theme.textSecondary }}>
                • {warning}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px' }}>Selected Templates ({selectedTemplates.length})</h4>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: theme.bgSecondary,
            padding: '12px',
            borderRadius: '4px'
          }}>
            {selectedTemplates.map((template) => (
              <div key={template.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: template.is_active ? theme.success : theme.textMuted
                }} />
                <span style={{ fontSize: '14px' }}>{template.name}</span>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>
                  v{template.version}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              color: theme.text,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: details.color,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {details.title}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

## Accessibility Considerations

### Keyboard Navigation

1. **Tab Order**: Modal → Search → Filters → Sort → View Toggle → Templates → Bulk Actions → Close
2. **Arrow Keys**: Navigate between templates in grid/list view
3. **Space/Enter**: Select templates or trigger actions
4. **Escape**: Close modal or cancel current action
5. **Ctrl+A**: Select all templates (when in bulk mode)
6. **Ctrl+D**: Deselect all templates

### Screen Reader Support

```typescript
// ARIA Labels and Roles
<div
  role="dialog"
  aria-labelledby="template-library-title"
  aria-describedby="template-library-description"
  aria-modal="true"
>
  <h2 id="template-library-title">Template Library</h2>
  <p id="template-library-description">
    Manage your prompt templates. Use arrow keys to navigate, space to select.
  </p>
  
  <div role="grid" aria-label="Template list">
    {templates.map((template) => (
      <div
        key={template.id}
        role="gridcell"
        aria-selected={selectedTemplates.has(template.id)}
        aria-label={`Template ${template.name}, version ${template.version}, ${template.is_active ? 'active' : 'inactive'}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Template content */}
      </div>
    ))}
  </div>
</div>
```

### Visual Accessibility

1. **High Contrast**: Support for high contrast mode
2. **Color Independence**: Never rely solely on color to convey information
3. **Focus Indicators**: Clear focus outlines on all interactive elements
4. **Text Size**: Support for browser zoom up to 200%
5. **Motion Reduction**: Respect `prefers-reduced-motion` setting

## Mobile Responsiveness Strategy

### Breakpoints

```typescript
const breakpoints = {
  mobile: '< 768px',
  tablet: '768px - 1024px',
  desktop: '> 1024px'
}
```

### Mobile-First Design

1. **Touch-Friendly**: Minimum 44px touch targets
2. **Simplified UI**: Collapse filters into dropdown on mobile
3. **Swipe Actions**: Swipe left/right for template actions
4. **Responsive Layout**: Stack elements vertically on small screens
5. **Performance**: Virtualization for large template lists

### Mobile Layout Adaptations

```typescript
const useMobileLayout = () => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

// Mobile-specific component structure
const MobileTemplateLibrary = () => {
  return (
    <div style={{ padding: '16px' }}>
      {/* Collapsible search & filters */}
      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="Search templates..." />
        <button>🔽 Filters</button>
      </div>
      
      {/* List view only on mobile */}
      <div>
        {templates.map((template) => (
          <MobileTemplateCard key={template.id} template={template} />
        ))}
      </div>
      
      {/* Sticky bottom actions */}
      <div style={{ 
        position: 'fixed', 
        bottom: '16px', 
        left: '16px', 
        right: '16px',
        backgroundColor: theme.bgSecondary,
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <div>Selected: {selectedTemplates.size} templates</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button>Activate</button>
          <button>Delete</button>
          <button>More...</button>
        </div>
      </div>
    </div>
  )
}
```

## Integration with Existing Design System

### Theme Integration

```typescript
// Extend existing theme with modal-specific tokens
const modalTheme = {
  ...theme,
  modal: {
    backdrop: darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
    maxWidth: '1200px',
    borderRadius: '12px',
    boxShadow: darkMode 
      ? '0 20px 40px rgba(0, 0, 0, 0.4)' 
      : '0 20px 40px rgba(0, 0, 0, 0.15)',
    padding: '24px'
  },
  templateCard: {
    hoverScale: '1.02',
    selectedScale: '1.01',
    transition: 'all 0.15s ease'
  }
}
```

### Component Consistency

1. **Button Styles**: Use existing Button component with consistent variants
2. **Input Fields**: Match existing form input styling
3. **Loading States**: Use existing loading spinner component
4. **Error Handling**: Integrate with existing error toast system
5. **Animations**: Follow existing transition patterns

## Performance Optimizations

### Virtual Scrolling

```typescript
import { FixedSizeList as List } from 'react-window'

const VirtualizedTemplateList = ({ templates, itemHeight = 80 }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <TemplateRow template={templates[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={templates.length}
      itemSize={itemHeight}
      itemData={templates}
    >
      {Row}
    </List>
  )
}
```

### Search Optimization

```typescript
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

const useTemplateSearch = (templates: PromptTemplate[]) => {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  
  const filteredTemplates = useMemo(() => {
    if (!debouncedQuery) return templates
    
    return templates.filter(template =>
      template.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(debouncedQuery.toLowerCase())
    )
  }, [templates, debouncedQuery])
  
  return { searchQuery, setSearchQuery, filteredTemplates }
}
```

## File Structure

```
src/
├── components/
│   ├── TemplateLibrary/
│   │   ├── TemplateLibraryModal.tsx
│   │   ├── TemplateCard.tsx
│   │   ├── TemplateRow.tsx
│   │   ├── TemplatePreview.tsx
│   │   ├── BulkActionDialog.tsx
│   │   ├── TemplateFilters.tsx
│   │   └── hooks/
│   │       ├── useTemplateLibrary.ts
│   │       ├── useTemplateSearch.ts
│   │       └── useTemplateActions.ts
│   └── shared/
│       ├── Modal.tsx
│       ├── Button.tsx
│       └── LoadingSpinner.tsx
├── types/
│   └── template.ts
└── utils/
    └── templateUtils.ts
```

This comprehensive design document provides a complete blueprint for implementing the Template Library Modal component while maintaining consistency with the existing Prompt Engineering Dashboard design system and ensuring excellent user experience across all devices and accessibility requirements.