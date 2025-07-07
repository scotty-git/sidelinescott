# CleanerContext.md Implementation Guide

## Executive Summary

This document provides detailed implementation guidance for building the cleanercontext.md vision from scratch. Every architectural insight and recommendation from the original document is translated into concrete implementation steps using our modern tech stack.

**Core Mission**: Build a stateful, intelligent transcript cleaning system that processes only user turns, maintains cleaned conversation history, and enables real-time self-correction through transparent UI updates.

## 🎯 Fundamental Architecture Insights

### 1. Stateful Cleaning is Essential

**Problem Solved**: Raw historical turns in sliding window perpetuate errors over time.

**Implementation Strategy**:
```typescript
class ConversationState {
  private rawTranscript: Turn[] = [];      // Keep for debugging
  private cleanedTranscript: Turn[] = [];  // Use for context
  private contextPatterns: string[] = [];  // Track conversation topics
  private confidenceScores: number[] = []; // Track cleaning confidence
  
  addTurn(rawTurn: Turn, cleanedTurn: CleanedTurn) {
    this.rawTranscript.push(rawTurn);
    this.cleanedTranscript.push(cleanedTurn);
    this.confidenceScores.push(cleanedTurn.metadata.confidence_score);
  }
  
  getSlidingWindow(size: number = 5): Turn[] {
    // CRITICAL: Return cleaned history, not raw
    return this.cleanedTranscript.slice(-size);
  }
}
```

**Test Cases**:
```typescript
describe('Stateful Cleaning', () => {
  it('should use cleaned history in context', () => {
    const state = new ConversationState();
    
    // Turn 1: Error gets corrected
    const rawTurn1 = { speaker: 'User', text: "I'm the vector of marketing" };
    const cleanedTurn1 = { speaker: 'User', text: "I'm the Director of Marketing" };
    state.addTurn(rawTurn1, cleanedTurn1);
    
    // Turn 5: Context should include cleaned version
    const context = state.getSlidingWindow();
    expect(context[0].text).toContain("Director of Marketing");
    expect(context[0].text).not.toContain("vector of marketing");
  });
});
```

### 2. Lumen's Output is Perfect - Only Clean User Input

**Implementation Strategy**:
```typescript
class TranscriptProcessor {
  async processTurn(speaker: string, rawText: string): Promise<ProcessedTurn> {
    if (speaker === 'AI' || speaker === 'Lumen') {
      // Lumen's output is perfect from Google - skip processing
      return {
        cleaned_text: rawText,
        metadata: {
          cleaning_applied: false,
          speaker: 'Lumen',
          processing_time: 0
        }
      };
    }
    
    // User turn needs intelligent processing
    return await this.cleanUserTurn(rawText);
  }
  
  private async cleanUserTurn(rawText: string): Promise<ProcessedTurn> {
    const cleaningLevel = this.assessCleaningNeed(rawText);
    
    if (cleaningLevel === 'none') {
      return this.passThrough(rawText);
    }
    
    return await this.performCleaning(rawText, cleaningLevel);
  }
}
```

**Performance Impact**:
- 50% reduction in processing (skip Lumen turns)
- Zero latency for perfect Lumen responses
- Simplified pipeline reduces error surface

### 3. Flexible Context Awareness (Not Rigid Phases)

**Implementation Strategy**:
```typescript
class FlexibleContextDetector {
  private contextMarkers = {
    identity_discussion: ['job title', 'role', 'position', 'head of', 'director'],
    company_info: ['employees', 'team size', 'based in', 'services', 'company'],
    marketing_discussion: ['channels', 'PPC', 'Facebook', 'Google', 'leads', 'traffic'],
    volume_discussion: ['visitors', 'calls', 'forms', 'monthly', 'leads per'],
    motivation: ['interested', 'looking for', 'challenge', 'problem', 'need'],
    demo_readiness: ['ready', 'let\'s do it', 'sounds good', 'yes', 'when can']
  };
  
  detectActiveContexts(cleanedHistory: Turn[]): string[] {
    const activeContexts: string[] = [];
    
    // Look at recent conversation (last 3 turns)
    const recentText = cleanedHistory
      .slice(-3)
      .map(turn => turn.text)
      .join(' ')
      .toLowerCase();
    
    // Multiple contexts can be active simultaneously
    for (const [context, markers] of Object.entries(this.contextMarkers)) {
      if (markers.some(marker => recentText.includes(marker))) {
        activeContexts.push(context);
      }
    }
    
    return activeContexts.length > 0 ? activeContexts : ['general'];
  }
}
```

**Dynamic Context Handling**:
```typescript
// Contexts can appear in any order and overlap
interface ContextState {
  current: string[];     // Currently active contexts
  history: string[];     // All contexts seen in conversation
  transitions: number;   // How many context changes occurred
}

class ContextManager {
  updateContexts(newContexts: string[]): ContextTransition {
    const added = newContexts.filter(c => !this.current.includes(c));
    const removed = this.current.filter(c => !newContexts.includes(c));
    
    return {
      added,
      removed,
      stable: newContexts.filter(c => this.current.includes(c))
    };
  }
}
```

## 🔧 JSON Output Format Implementation

### Exact Specification
```typescript
interface CleanerResponse {
  cleaned_text: string;
  metadata: {
    confidence_score: 'HIGH' | 'MEDIUM' | 'LOW';
    cleaning_applied: boolean;
    cleaning_level: 'none' | 'light' | 'full';
    corrections: Correction[];
    context_detected: string;
    processing_time_ms: number;
  };
}

interface Correction {
  original: string;
  corrected: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  position: {
    start: number;
    end: number;
  };
}
```

### Real-time Integration Handler
```typescript
class CleanerOutputHandler {
  async processCleanerResponse(response: CleanerResponse): Promise<void> {
    // 1. Update transcript with cleaned text
    await this.updateTranscript(response.cleaned_text);
    
    // 2. Process metadata separately for monitoring
    await this.trackCleaningMetrics(response.metadata);
    
    // 3. Make real-time UI decisions based on confidence
    await this.updateUIBasedOnConfidence(response);
    
    // 4. Store for quality tracking and learning
    await this.storeForAnalytics(response);
  }
  
  private async updateUIBasedOnConfidence(response: CleanerResponse) {
    const { confidence_score, corrections } = response.metadata;
    
    switch (confidence_score) {
      case 'HIGH':
        // Subtle indication - user barely notices
        this.showSubtleCorrections(corrections);
        break;
      case 'MEDIUM':
        // Slightly more visible
        this.showMediumConfidenceIndicators(corrections);
        break;
      case 'LOW':
        // Clear marker that might need attention
        this.showLowConfidenceWarnings(corrections);
        break;
    }
  }
}
```

## 🧠 Intelligent Cleaning Decision Engine

### Core Decision Logic
```typescript
class CleaningDecisionEngine {
  assessCleaningNeed(rawTurn: string): 'none' | 'light' | 'full' {
    // 1. No cleaning needed
    if (this.isSimpleAcknowledgment(rawTurn)) {
      return 'none'; // "Yes", "That's right", "Correct"
    }
    
    // 2. Light cleaning only
    if (this.isClearButNeedsFormatting(rawTurn)) {
      return 'light'; // Fix punctuation, capitalization
    }
    
    // 3. Full cleaning required
    if (this.containsErrorPatterns(rawTurn)) {
      return 'full'; // Known STT errors, numbers to convert
    }
    
    return 'light'; // Default to light touch
  }
  
  private isSimpleAcknowledgment(text: string): boolean {
    const acknowledgments = [
      'yes', 'yeah', 'yep', 'correct', 'right', 'exactly',
      'that\'s right', 'mm-hmm', 'uh-huh', 'okay', 'ok'
    ];
    
    const normalized = text.toLowerCase().trim();
    return acknowledgments.some(ack => 
      normalized === ack || normalized.startsWith(ack + ' ')
    );
  }
  
  private containsErrorPatterns(text: string): boolean {
    const errorPatterns = [
      /\bvector of\b/i,           // "vector of" → "Director of"
      /\bgeneric CEO\b/i,         // "generic CEO" → "generic SEO"
      /\bbook marketing\b/i,      // "book" → "Facebook"
      /\bchecker trade\b/i,       // "checker trade" → "Checkatrade"
      /\bpaper click\b/i,         // "paper click" → "pay per click"
      /\b(fifty|seventy|hundred)\b/i, // Numbers as words
      /[^\x00-\x7F]+/            // Non-ASCII characters
    ];
    
    return errorPatterns.some(pattern => pattern.test(text));
  }
}
```

### Performance Optimization
```typescript
// Cache decision patterns for speed
class OptimizedDecisionEngine extends CleaningDecisionEngine {
  private decisionCache = new Map<string, 'none' | 'light' | 'full'>();
  
  assessCleaningNeed(rawTurn: string): 'none' | 'light' | 'full' {
    const cacheKey = this.generateCacheKey(rawTurn);
    
    if (this.decisionCache.has(cacheKey)) {
      return this.decisionCache.get(cacheKey)!;
    }
    
    const decision = super.assessCleaningNeed(rawTurn);
    this.decisionCache.set(cacheKey, decision);
    
    return decision;
  }
  
  private generateCacheKey(text: string): string {
    // Create cache key based on text patterns, not exact text
    return text.toLowerCase()
      .replace(/\d+/g, 'NUM')      // Normalize numbers
      .replace(/[^\w\s]/g, '')     // Remove punctuation
      .trim()
      .substring(0, 50);           // Limit key length
  }
}
```

## 🎯 Confidence-Based Auto-Application

### Core Confidence System
```typescript
class ConfidenceBasedProcessor {
  async processWithConfidence(
    cleanedResult: CleanerResponse
  ): Promise<ProcessingDecision> {
    const { confidence_score, corrections } = cleanedResult.metadata;
    
    switch (confidence_score) {
      case 'HIGH':
        return this.autoApplyWithConfidence(cleanedResult);
        
      case 'MEDIUM':
        return this.autoApplyWithTracking(cleanedResult);
        
      case 'LOW':
        return this.applyWithMarker(cleanedResult);
        
      default:
        throw new Error(`Unknown confidence level: ${confidence_score}`);
    }
  }
  
  private async autoApplyWithConfidence(result: CleanerResponse): Promise<ProcessingDecision> {
    // Apply automatically - trust Gemini's judgment
    await this.applyCorrections(result.corrections);
    
    return {
      applied: true,
      userNotification: 'subtle',
      tracking: 'standard'
    };
  }
  
  private async autoApplyWithTracking(result: CleanerResponse): Promise<ProcessingDecision> {
    // Apply but track more closely for learning
    await this.applyCorrections(result.corrections);
    await this.trackMediumConfidenceDecision(result);
    
    return {
      applied: true,
      userNotification: 'visible',
      tracking: 'enhanced'
    };
  }
  
  private async applyWithMarker(result: CleanerResponse): Promise<ProcessingDecision> {
    // Apply but mark for potential review
    await this.applyCorrections(result.corrections);
    await this.addReviewMarker(result);
    
    return {
      applied: true,
      userNotification: 'prominent',
      tracking: 'review_required'
    };
  }
}
```

### Trust in Gemini's Judgment
```typescript
// Trust the same model that powers Lumen
class GeminiTrustSystem {
  private trustThresholds = {
    HIGH: 0.9,    // Apply with full confidence
    MEDIUM: 0.7,  // Apply but track
    LOW: 0.5      // Apply with markers
  };
  
  validateGeminiConfidence(response: CleanerResponse): boolean {
    // Gemini understands corrections internally even when not verbalizing
    // We should have the same confidence in its judgment
    
    const { confidence_score, corrections } = response.metadata;
    
    // Trust Gemini's self-assessment
    return corrections.every(correction => 
      this.isReasonableCorrection(correction, confidence_score)
    );
  }
  
  private isReasonableCorrection(
    correction: Correction, 
    overallConfidence: string
  ): boolean {
    // Trust Gemini's contextual understanding
    const contextualCorrections = [
      'vector of → Director of',
      'book → Facebook',
      'generic CEO → generic SEO',
      'paper click → pay per click'
    ];
    
    const pattern = `${correction.original} → ${correction.corrected}`;
    
    // If it's a known contextual correction, trust it
    if (contextualCorrections.some(known => pattern.includes(known))) {
      return true;
    }
    
    // Otherwise, trust based on confidence level
    return overallConfidence !== 'LOW';
  }
}
```

## 🔄 Self-Correcting System Implementation

### Real-time Visibility Architecture
```typescript
class SelfCorrectingSystem {
  private realTimeUpdater: RealTimeUpdater;
  private correctionTracker: CorrectionTracker;
  
  async handleTranscriptUpdate(update: CleanerResponse): Promise<void> {
    // 1. Update screen immediately with cleaned data
    await this.realTimeUpdater.updateTranscriptDisplay(update.cleaned_text);
    
    // 2. Show corrections transparently
    await this.realTimeUpdater.highlightCorrections(update.metadata.corrections);
    
    // 3. Enable natural correction flow
    this.setupCorrectionListener(update);
  }
  
  private setupCorrectionListener(originalUpdate: CleanerResponse): void {
    // Listen for user corrections in subsequent turns
    this.onNextUserTurn((newTurn: string) => {
      const correction = this.detectCorrection(originalUpdate, newTurn);
      
      if (correction) {
        this.handleUserCorrection(originalUpdate, correction);
      }
    });
  }
  
  private async handleUserCorrection(
    original: CleanerResponse,
    correction: UserCorrection
  ): Promise<void> {
    // Example flow:
    // Turn 1: "I'm the vector of marketing"
    // Screen: "Director of Marketing" ✓
    // Turn 2: "Actually, I meant Director of Operations"
    // Screen: "Director of Operations" ✓
    
    // Process the correction as a new turn
    const correctedResult = await this.processCorrection(correction);
    
    // Update screen with new information
    await this.realTimeUpdater.updateWithCorrection(correctedResult);
    
    // Learn from the correction
    await this.correctionTracker.recordCorrection(original, correctedResult);
  }
}
```

### Natural Conversation Flow
```typescript
interface UserCorrection {
  originalText: string;
  correctedText: string;
  correctionType: 'replacement' | 'addition' | 'clarification';
  confidence: number;
}

class CorrectionDetector {
  detectCorrection(
    previousUpdate: CleanerResponse,
    newUserTurn: string
  ): UserCorrection | null {
    // Pattern recognition for corrections
    const correctionPatterns = [
      /actually,?\s*i\s*meant\s*/i,
      /no,?\s*it'?s\s*/i,
      /sorry,?\s*i\s*said\s*/i,
      /let me correct that/i,
      /that should be/i
    ];
    
    for (const pattern of correctionPatterns) {
      if (pattern.test(newUserTurn)) {
        return this.extractCorrection(previousUpdate, newUserTurn);
      }
    }
    
    return null;
  }
  
  private extractCorrection(
    previous: CleanerResponse,
    correctionTurn: string
  ): UserCorrection {
    // Extract the actual correction from the user's statement
    // This is where NLP helps identify what's being corrected
    
    return {
      originalText: previous.cleaned_text,
      correctedText: this.parseCorrection(correctionTurn),
      correctionType: this.classifyCorrection(correctionTurn),
      confidence: this.assessCorrectionConfidence(correctionTurn)
    };
  }
}
```

## 📊 Context-Aware Prompt Engineering

### Dynamic Prompt Construction
```typescript
class ContextAwarePromptBuilder {
  buildCleaningPrompt(
    rawTurn: string,
    contexts: ContextState,
    slidingWindow: Turn[],
    sharedContext?: string
  ): string {
    const template = `
# Lumen Transcript Cleaner - Domain-Aware System

You are a specialist transcript cleaner for Lumen AI business qualification calls.
Your sole responsibility is to produce accurate transcripts from speech-to-text output.

## Your Mission
Transform raw user speech into clean, accurate transcripts.
You only clean User turns - Lumen's output is already perfect.

## Critical Instructions for Output
You MUST return valid JSON with this exact structure:
{
  "cleaned_text": "The cleaned user text here",
  "metadata": {
    "confidence_score": "HIGH|MEDIUM|LOW",
    "cleaning_applied": true|false,
    "cleaning_level": "none|light|full",
    "corrections": [
      {
        "original": "text that was changed",
        "corrected": "what it became",
        "confidence": "HIGH|MEDIUM|LOW",
        "reason": "brief explanation"
      }
    ],
    "context_detected": "${contexts.current.join(',')}"
  }
}

## Available Context
${sharedContext ? `Shared user information:\n${sharedContext}\n` : ''}

Previous CLEANED conversation (not raw):
${this.formatSlidingWindow(slidingWindow)}

Active conversation contexts: ${contexts.current.join(', ')}

## Business Context Awareness
${this.buildContextSpecificGuidance(contexts.current)}

Current turn to clean:
${rawTurn}

## Cleaning Decision Tree
1. First assess if cleaning is needed:
   - Simple acknowledgments ("Yes", "That's right") → Return as-is
   - Clear speech with minor formatting issues → Light cleaning only
   - Contains error patterns or unclear elements → Full cleaning

2. Apply appropriate cleaning level based on context and patterns

Remember: Your job is accurate transcription, not data analysis.
Users see results on screen and can correct naturally.
Apply HIGH/MEDIUM confidence corrections automatically.
Trust the contextual intelligence you share with Lumen.
Return ONLY the JSON output, no additional text.
`;

    return template;
  }
  
  private buildContextSpecificGuidance(activeContexts: string[]): string {
    const contextGuidance = {
      identity_discussion: `
Professional Titles:
- "vector of/hat of" → "Director of/Head of" (HIGH confidence)
- Correct to standard business titles
`,
      marketing_discussion: `
Marketing Terms:
- "book/Book" → "Facebook" (HIGH confidence)
- "generic CEO" → "generic SEO" (HIGH confidence)
- "paper click" → "pay per click/PPC" (HIGH confidence)
`,
      company_info: `
Company Information:
- Preserve exact company names
- "seventy-five people" → "75 people" (proper number format)
`,
      volume_discussion: `
Numbers (for clarity):
- "fifty to a hundred" → "50 to 100"
- "couple thousand" → "2000"
- Always convert to digits for clarity
`
    };
    
    return activeContexts
      .map(context => contextGuidance[context] || '')
      .filter(guidance => guidance.length > 0)
      .join('\n');
  }
}
```

## 🧪 Testing Strategy for CleanerContext Implementation

### Core Component Tests
```typescript
describe('CleanerContext Implementation', () => {
  describe('Stateful Cleaning', () => {
    it('should maintain cleaned history in sliding window', async () => {
      const processor = new TranscriptProcessor();
      const state = new ConversationState();
      
      // Process multiple turns with errors
      const turns = [
        { text: "I'm the vector of marketing", speaker: "User" },
        { text: "We have seventy five people", speaker: "User" },
        { text: "Our book ads are working well", speaker: "User" }
      ];
      
      for (const turn of turns) {
        const result = await processor.processTurn(turn.speaker, turn.text);
        state.addTurn(turn, result);
      }
      
      const slidingWindow = state.getSlidingWindow(3);
      
      // Verify cleaned versions are in context
      expect(slidingWindow[0].text).toContain("Director of marketing");
      expect(slidingWindow[1].text).toContain("75 people");
      expect(slidingWindow[2].text).toContain("Facebook ads");
      
      // Verify raw errors are NOT in context
      expect(slidingWindow.some(turn => turn.text.includes("vector of"))).toBe(false);
      expect(slidingWindow.some(turn => turn.text.includes("seventy five"))).toBe(false);
      expect(slidingWindow.some(turn => turn.text.includes("book ads"))).toBe(false);
    });
  });
  
  describe('User-Turn-Only Processing', () => {
    it('should skip Lumen turns completely', async () => {
      const processor = new TranscriptProcessor();
      const startTime = performance.now();
      
      const result = await processor.processTurn(
        'Lumen',
        'Thank you for that information. Can you tell me more about your marketing channels?'
      );
      
      const processingTime = performance.now() - startTime;
      
      expect(result.metadata.cleaning_applied).toBe(false);
      expect(result.metadata.speaker).toBe('Lumen');
      expect(processingTime).toBeLessThan(1); // Near-zero processing time
    });
  });
  
  describe('Flexible Context Detection', () => {
    it('should detect multiple overlapping contexts', () => {
      const detector = new FlexibleContextDetector();
      const history = [
        { text: "I'm the Director of Marketing", speaker: "User" },
        { text: "We have 75 employees and focus on PPC campaigns", speaker: "User" }
      ];
      
      const contexts = detector.detectActiveContexts(history);
      
      expect(contexts).toContain('identity_discussion');
      expect(contexts).toContain('company_info');
      expect(contexts).toContain('marketing_discussion');
      expect(contexts.length).toBeGreaterThan(1);
    });
  });
  
  describe('Confidence-Based Auto-Application', () => {
    it('should auto-apply HIGH confidence corrections', async () => {
      const processor = new ConfidenceBasedProcessor();
      const response: CleanerResponse = {
        cleaned_text: "I'm the Director of Marketing",
        metadata: {
          confidence_score: 'HIGH',
          cleaning_applied: true,
          cleaning_level: 'full',
          corrections: [{
            original: "vector of",
            corrected: "Director of",
            confidence: 'HIGH',
            reason: "contextual_understanding"
          }],
          context_detected: "identity_discussion"
        }
      };
      
      const decision = await processor.processWithConfidence(response);
      
      expect(decision.applied).toBe(true);
      expect(decision.userNotification).toBe('subtle');
      expect(decision.tracking).toBe('standard');
    });
  });
});
```

### Integration Tests
```typescript
describe('End-to-End CleanerContext Flow', () => {
  it('should process a complete conversation with self-correction', async () => {
    const system = new SelfCorrectingSystem();
    const conversation = [
      { speaker: "User", text: "I'm the vector of marketing at quick fit windows" },
      { speaker: "Lumen", text: "Thank you for that information. How many employees do you have?" },
      { speaker: "User", text: "We have seventy five people" },
      { speaker: "User", text: "Actually, I meant Director of Operations, not marketing" }
    ];
    
    const results = [];
    
    for (const turn of conversation) {
      const result = await system.processTurn(turn.speaker, turn.text);
      results.push(result);
    }
    
    // Verify initial cleaning
    expect(results[0].cleaned_text).toContain("Director of marketing");
    
    // Verify Lumen turn was skipped
    expect(results[1].metadata.cleaning_applied).toBe(false);
    
    // Verify number conversion
    expect(results[2].cleaned_text).toContain("75 people");
    
    // Verify self-correction was detected and applied
    expect(results[3].cleaned_text).toContain("Director of Operations");
    
    // Verify conversation state reflects correction
    const finalState = system.getConversationState();
    expect(finalState.cleanedTranscript[0].text).toContain("Director of Operations");
  });
});
```

## 📈 Quality Metrics and Monitoring

### Success Metrics Implementation
```typescript
class CleanerContextMetrics {
  private metrics: QualityMetrics = {
    transcriptionAccuracy: 0,      // Target: > 95%
    highConfidenceRate: 0,         // Target: > 70%
    appropriateCleaningDecisions: 0, // Target: > 85%
    userSelfCorrectionRate: 0,     // Target: < 10%
    lumenProcessingTime: 0         // Target: 0ms (skipped)
  };
  
  async evaluateCleaningSession(session: CleaningSession): Promise<QualityReport> {
    const results = await Promise.all([
      this.measureTranscriptionAccuracy(session),
      this.measureConfidenceDistribution(session),
      this.measureCleaningDecisionAccuracy(session),
      this.measureSelfCorrectionRate(session),
      this.measureProcessingEfficiency(session)
    ]);
    
    return {
      session_id: session.id,
      metrics: this.compileMetrics(results),
      recommendations: this.generateRecommendations(results),
      success_criteria_met: this.evaluateSuccessCriteria(results)
    };
  }
  
  private async measureTranscriptionAccuracy(session: CleaningSession): Promise<number> {
    // Compare cleaned output against expected ground truth
    let correctTranscriptions = 0;
    let totalTranscriptions = 0;
    
    for (const turn of session.turns) {
      if (turn.expected_cleaned_text) {
        const similarity = this.calculateSimilarity(
          turn.actual_cleaned_text,
          turn.expected_cleaned_text
        );
        
        if (similarity > 0.95) {
          correctTranscriptions++;
        }
        totalTranscriptions++;
      }
    }
    
    return totalTranscriptions > 0 ? correctTranscriptions / totalTranscriptions : 0;
  }
}
```

## 🚀 Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
1. **Stateful Conversation Management**
   - Implement ConversationState class
   - Build sliding window with cleaned history
   - Add comprehensive tests for state management

2. **User-Turn-Only Processing**
   - Implement speaker detection logic
   - Add Lumen turn bypass with zero processing time
   - Verify performance improvements

### Phase 2: Intelligent Processing (Week 2)
1. **Cleaning Decision Engine**
   - Implement none/light/full decision logic
   - Add error pattern recognition
   - Optimize with caching for performance

2. **JSON Output Format**
   - Implement exact CleanerResponse specification
   - Add metadata tracking and storage
   - Build real-time UI integration handlers

### Phase 3: Advanced Features (Week 3)
1. **Flexible Context Detection**
   - Implement business pattern recognition
   - Add dynamic context transitions
   - Build context-aware prompt generation

2. **Confidence-Based Auto-Application**
   - Implement HIGH/MEDIUM/LOW handling
   - Add trust system for Gemini decisions
   - Build correction tracking and learning

### Phase 4: Self-Correction System (Week 4)
1. **Real-time Visibility**
   - Implement transparent correction display
   - Add WebSocket-based updates
   - Build natural correction flow detection

2. **Quality Monitoring**
   - Implement comprehensive metrics tracking
   - Add success criteria evaluation
   - Build quality dashboards and alerts

---

This implementation guide provides the complete roadmap for building the cleanercontext.md vision from scratch. Every architectural insight has been translated into concrete, testable code that can be built incrementally with confidence.