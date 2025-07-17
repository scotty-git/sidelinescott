# Copy Compact Button Implementation Guide

## Overview
This guide shows how to add a "Copy Compact" button that exports simplified JSON data containing only essential fields: `sequence`, `speaker`, `raw_text`, and `cleaned_text`.

## Problem Solved
The original copy button exports huge JSON files with timing data, metadata, and AI processing details. The compact version reduces file size by 80%+ by including only the core conversation data.

## Implementation

### 1. Locate the Copy Button Code
Find the existing copy button in your `TranscriptCleanerPro.tsx` file (around line 1565):

```tsx
{/* Copy JSON Button */}
{cleanedTurns.length > 0 && !isProcessing && (
  <button onClick={async () => { /* existing copy logic */ }}>
    📋 Copy
  </button>
)}
```

### 2. Add the Copy Compact Button
Add this code immediately after the existing copy button:

```tsx
{/* Copy Compact Button */}
{cleanedTurns.length > 0 && !isProcessing && (
  <button
    onClick={async () => {
      // Find the current evaluation ID from the loaded data
      const evaluationId = currentEvaluationId || cleanedTurns[0]?.evaluation_id
      if (!evaluationId) {
        alert('No evaluation data available to copy')
        return
      }
      
      try {
        // Get the full export data
        const exportData = await apiClient.exportEvaluation(evaluationId)
        
        // Create compact version with only essential fields
        const compactData = {
          compact_export: {
            exported_at: new Date().toISOString(),
            evaluation_name: exportData.evaluation.name,
            turns: exportData.turns.map(turn => ({
              sequence: turn.sequence,
              speaker: turn.speaker,
              raw_text: turn.raw_text,
              cleaned_text: turn.cleaned_data.cleaned_text
            }))
          }
        }
        
        // Copy compact data using simple clipboard method
        const jsonString = JSON.stringify(compactData, null, 2)
        await navigator.clipboard.writeText(jsonString)
        alert('Compact JSON copied to clipboard!')
        addDetailedLog(`📋 Copied compact JSON to clipboard: ${exportData.evaluation.name} (${compactData.compact_export.turns.length} turns)`)
        
      } catch (error) {
        console.error('Failed to copy compact evaluation:', error)
        alert('Failed to copy compact evaluation. Please try again.')
      }
    }}
    style={{
      padding: '6px 12px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: '#3b82f6',
      color: 'white',
      cursor: 'pointer',
      marginLeft: '8px'
    }}
  >
    📋 Copy Compact
  </button>
)}
```

## Output Format

### Before (Full Export - ~100KB+)
```json
{
  "export_metadata": { ... },
  "evaluation": { ... },
  "conversation": { ... },
  "turns": [
    {
      "turn_id": "uuid",
      "sequence": 1,
      "speaker": "User",
      "raw_text": "Hello",
      "cleaned_data": {
        "cleaned_text": "Hello",
        "cleaning_applied": "true",
        "ai_model_used": "gemini-2.5-flash-lite",
        "timing_breakdown": { ... },
        "gemini_details": { ... }
      }
    }
  ],
  "summary": { ... }
}
```

### After (Compact Export - ~5KB)
```json
{
  "compact_export": {
    "exported_at": "2024-07-17T10:30:00.000Z",
    "evaluation_name": "My Evaluation",
    "turns": [
      {
        "sequence": 1,
        "speaker": "User",
        "raw_text": "Hello",
        "cleaned_text": "Hello"
      }
    ]
  }
}
```

## Key Features

1. **Dramatically Smaller Files**: 80%+ size reduction
2. **Simple Structure**: Only essential conversation data
3. **Same Reliability**: Uses simple clipboard API like existing copy logs
4. **Visual Feedback**: Alert confirmation and detailed logging
5. **Error Handling**: Graceful failure with user-friendly messages

## Styling Notes

- **Button Color**: Blue (`#3b82f6`) to differentiate from green copy button
- **Spacing**: `marginLeft: '8px'` to separate from original copy button
- **Consistent**: Same padding, border-radius, and font styling as existing buttons

## Testing

1. Load a conversation with cleaned turns
2. Both "📋 Copy" and "📋 Copy Compact" buttons should appear
3. Click "📋 Copy Compact"
4. Paste the clipboard content - should show only the essential fields
5. File size should be dramatically smaller than the full export

## Dependencies

- Requires existing `apiClient.exportEvaluation()` method
- Uses `navigator.clipboard.writeText()` for clipboard access
- Needs `addDetailedLog()` function for logging (optional)

## Browser Compatibility

Uses the simple `navigator.clipboard.writeText()` API which works in all modern browsers. No complex ClipboardItem handling needed.