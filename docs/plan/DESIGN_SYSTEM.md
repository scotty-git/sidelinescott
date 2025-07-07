# Design System - Reconnaissance-First UI/UX Excellence

## 🎯 Design Process Philosophy

**Core Principle**: Reconnaissance → Consistency → Polish → User Focus

Every component, interaction, and visual element follows a systematic approach that prioritizes user experience, maintains consistency, and delivers sub-100ms feedback across all interactions.

## 🔍 Reconnaissance-First Approach

### Pre-Development Research Process

Before building any component, follow this systematic reconnaissance:

```typescript
interface ReconnaissanceChecklist {
  existingComponents: ComponentAnalysis[];
  designPatterns: PatternLibrary;
  interactionBehaviors: InteractionMap;
  responsivePatterns: ResponsiveBreakpoints;
  accessibilityStandards: A11yRequirements;
}

class ComponentReconnaissance {
  async analyzeExistingPatterns(componentType: string): Promise<ComponentAnalysis> {
    // 1. Study 3-5 similar components in the existing system
    const similarComponents = await this.findSimilarComponents(componentType);
    
    // 2. Identify current design system patterns
    const designTokens = this.extractDesignTokens(similarComponents);
    
    // 3. Document interaction behaviors
    const interactions = this.analyzeInteractions(similarComponents);
    
    // 4. Check responsive behavior
    const responsive = this.analyzeResponsivePatterns(similarComponents);
    
    return {
      spacing: designTokens.spacing,
      colors: designTokens.colors,
      typography: designTokens.typography,
      interactions: interactions,
      responsive: responsive,
      accessibility: this.extractA11yPatterns(similarComponents)
    };
  }
}
```

### Component Study Template

```typescript
// Before building any component, complete this analysis:
interface ComponentStudy {
  componentName: string;
  purpose: string;
  existingExamples: {
    component: string;
    strengths: string[];
    weaknesses: string[];
    patterns: DesignPattern[];
  }[];
  designTokensUsed: {
    spacing: string[];     // p-4, m-2, gap-3, etc.
    colors: string[];      // bg-blue-500, text-gray-800, etc.
    typography: string[];  // text-lg, font-semibold, etc.
    shadows: string[];     // shadow-md, shadow-lg, etc.
    borders: string[];     // border, rounded-lg, etc.
  };
  interactionPatterns: {
    hover: string[];       // hover:bg-blue-600, etc.
    focus: string[];       // focus:ring-2, focus:outline-none, etc.
    active: string[];      // active:bg-blue-700, etc.
    disabled: string[];    // disabled:opacity-50, etc.
  };
  responsivePatterns: {
    mobile: string[];      // sm:hidden, sm:block, etc.
    tablet: string[];      // md:flex, md:w-1/2, etc.
    desktop: string[];     // lg:w-1/3, xl:text-xl, etc.
  };
}
```

## 🎨 Consistency-First Principles

### Design Token System with UnoCSS

```typescript
// uno.config.ts - Centralized design tokens
export default defineConfig({
  theme: {
    colors: {
      // Brand colors
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        900: '#0c4a6e'
      },
      // Semantic colors
      success: {
        50: '#f0fdf4',
        500: '#22c55e',
        700: '#15803d'
      },
      warning: {
        50: '#fffbeb',
        500: '#f59e0b',
        700: '#a16207'
      },
      error: {
        50: '#fef2f2',
        500: '#ef4444',
        700: '#b91c1c'
      },
      // Confidence levels for cleaning system
      confidence: {
        high: '#22c55e',    // Green - HIGH confidence
        medium: '#f59e0b',  // Yellow - MEDIUM confidence
        low: '#ef4444'      // Red - LOW confidence
      }
    },
    spacing: {
      // Consistent spacing scale
      'xs': '0.25rem',   // 4px
      'sm': '0.5rem',    // 8px
      'md': '1rem',      // 16px
      'lg': '1.5rem',    // 24px
      'xl': '2rem',      // 32px
      '2xl': '3rem',     // 48px
    },
    typography: {
      // Consistent text hierarchy
      'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
      'body-md': ['1rem', { lineHeight: '1.5rem' }],
      'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
      'heading-sm': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
      'heading-md': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
      'heading-lg': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
    },
    animation: {
      // Sub-100ms feedback animations
      'feedback-fast': 'feedback 0.05s ease-out',
      'feedback-normal': 'feedback 0.1s ease-out',
      'feedback-slow': 'feedback 0.2s ease-out',
    }
  }
});
```

### Component Consistency Rules

```typescript
// Base component patterns that ALL components follow
interface ConsistentComponentProps {
  // Standard sizing system
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Standard variant system
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  
  // Standard interaction states
  disabled?: boolean;
  loading?: boolean;
  
  // Standard accessibility props
  'aria-label'?: string;
  'aria-describedby'?: string;
}

class ConsistentComponent extends React.Component<ConsistentComponentProps> {
  // All components implement consistent patterns:
  
  getBaseClasses(): string {
    // Every component uses consistent base classes
    return 'transition-all duration-100 focus:outline-none focus:ring-2';
  }
  
  getSizeClasses(size: string): string {
    const sizes = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
      xl: 'px-8 py-4 text-xl'
    };
    return sizes[size] || sizes.md;
  }
  
  getVariantClasses(variant: string): string {
    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
      success: 'bg-success-500 text-white hover:bg-success-600 focus:ring-success-500',
      warning: 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-500',
      error: 'bg-error-500 text-white hover:bg-error-600 focus:ring-error-500'
    };
    return variants[variant] || variants.primary;
  }
}
```

## ⚡ Sub-100ms Feedback Requirements

### Immediate Visual Response System

```typescript
// Every user interaction gets < 50ms visual feedback
class FeedbackSystem {
  private feedbackStart: number = 0;
  
  onInteractionStart(element: HTMLElement, feedbackType: FeedbackType): void {
    this.feedbackStart = performance.now();
    
    // Immediate visual feedback (< 50ms)
    switch (feedbackType) {
      case 'button-click':
        element.classList.add('scale-95', 'bg-opacity-90');
        break;
      case 'input-focus':
        element.classList.add('ring-2', 'ring-primary-500');
        break;
      case 'hover':
        element.classList.add('shadow-md', 'transform', 'translate-y-[-1px]');
        break;
    }
    
    // Track feedback timing
    requestAnimationFrame(() => {
      const feedbackTime = performance.now() - this.feedbackStart;
      if (feedbackTime > 50) {
        console.warn(`Slow feedback detected: ${feedbackTime}ms`);
      }
    });
  }
  
  onInteractionEnd(element: HTMLElement, feedbackType: FeedbackType): void {
    // Remove feedback classes after interaction
    setTimeout(() => {
      switch (feedbackType) {
        case 'button-click':
          element.classList.remove('scale-95', 'bg-opacity-90');
          break;
        case 'input-focus':
          element.classList.remove('ring-2', 'ring-primary-500');
          break;
        case 'hover':
          element.classList.remove('shadow-md', 'transform', 'translate-y-[-1px]');
          break;
      }
    }, 100); // Complete feedback cycle in 100ms
  }
}
```

### Performance-Optimized Interactions

```typescript
// Button component with guaranteed sub-50ms feedback
interface ButtonProps extends ConsistentComponentProps {
  onClick?: () => void;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  size = 'md', 
  variant = 'primary', 
  disabled = false,
  loading = false,
  onClick,
  children,
  ...props 
}) => {
  const feedbackRef = useRef<HTMLButtonElement>(null);
  
  const handleMouseDown = useCallback(() => {
    if (feedbackRef.current && !disabled) {
      // Immediate visual feedback
      feedbackRef.current.style.transform = 'scale(0.95)';
      feedbackRef.current.style.opacity = '0.9';
    }
  }, [disabled]);
  
  const handleMouseUp = useCallback(() => {
    if (feedbackRef.current) {
      // Reset after feedback
      feedbackRef.current.style.transform = 'scale(1)';
      feedbackRef.current.style.opacity = '1';
    }
  }, []);
  
  const handleClick = useCallback(() => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  }, [disabled, loading, onClick]);
  
  const classes = useMemo(() => {
    const base = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-offset-2';
    const sizeClasses = getSizeClasses(size);
    const variantClasses = getVariantClasses(variant);
    const stateClasses = disabled 
      ? 'opacity-50 cursor-not-allowed' 
      : 'cursor-pointer hover:shadow-md active:shadow-sm';
    
    return `${base} ${sizeClasses} ${variantClasses} ${stateClasses}`;
  }, [size, variant, disabled]);
  
  return (
    <button
      ref={feedbackRef}
      className={classes}
      disabled={disabled || loading}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Reset if mouse leaves during press
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
};
```

## 🌊 Progressive Disclosure Patterns

### Layered Information Architecture

```typescript
// Don't overwhelm - reveal complexity gradually
interface ProgressiveDisclosureProps {
  basicContent: React.ReactNode;
  detailedContent?: React.ReactNode;
  advancedContent?: React.ReactNode;
  defaultExpanded?: 'basic' | 'detailed' | 'advanced';
}

const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  basicContent,
  detailedContent,
  advancedContent,
  defaultExpanded = 'basic'
}) => {
  const [expandedLevel, setExpandedLevel] = useState(defaultExpanded);
  
  return (
    <div className="space-y-4">
      {/* Always show basic content */}
      <div className="p-4 bg-white rounded-lg shadow-sm border">
        {basicContent}
      </div>
      
      {/* Show detailed content on request */}
      {detailedContent && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedLevel(
              expandedLevel === 'detailed' ? 'basic' : 'detailed'
            )}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {expandedLevel === 'detailed' ? 'Show less' : 'Show details'}
          </button>
          
          {expandedLevel !== 'basic' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              {detailedContent}
            </div>
          )}
        </div>
      )}
      
      {/* Show advanced content for experts */}
      {advancedContent && expandedLevel === 'detailed' && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedLevel(
              expandedLevel === 'advanced' ? 'detailed' : 'advanced'
            )}
            className="text-sm text-gray-600 hover:text-gray-700 font-medium"
          >
            {expandedLevel === 'advanced' ? 'Hide advanced' : 'Advanced options'}
          </button>
          
          {expandedLevel === 'advanced' && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              {advancedContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Smart Information Hierarchy

```typescript
// Cleaning confidence display with progressive disclosure
interface CleaningConfidenceDisplayProps {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  corrections: Correction[];
  cleanedText: string;
}

const CleaningConfidenceDisplay: React.FC<CleaningConfidenceDisplayProps> = ({
  confidence,
  corrections,
  cleanedText
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const confidenceConfig = {
    HIGH: {
      color: 'text-success-600',
      bg: 'bg-success-50',
      border: 'border-success-200',
      icon: '✓',
      message: 'High confidence cleaning applied'
    },
    MEDIUM: {
      color: 'text-warning-600',
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      icon: '◐',
      message: 'Medium confidence cleaning applied'
    },
    LOW: {
      color: 'text-error-600',
      bg: 'bg-error-50',
      border: 'border-error-200',
      icon: '⚠',
      message: 'Low confidence - please review'
    }
  };
  
  const config = confidenceConfig[confidence];
  
  return (
    <div className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
      {/* Basic level: Just show confidence and cleaned text */}
      <div className="flex items-center space-x-2">
        <span className={`text-lg ${config.color}`}>{config.icon}</span>
        <span className={`text-sm font-medium ${config.color}`}>
          {config.message}
        </span>
        {corrections.length > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`text-xs ${config.color} hover:underline`}
          >
            {showDetails ? 'Hide' : 'Show'} corrections
          </button>
        )}
      </div>
      
      {/* Progressive disclosure: Show corrections on request */}
      {showDetails && corrections.length > 0 && (
        <div className="mt-3 space-y-2">
          {corrections.map((correction, index) => (
            <div key={index} className="text-xs bg-white p-2 rounded border">
              <div className="flex justify-between items-center">
                <span className="font-mono">
                  "{correction.original}" → "{correction.corrected}"
                </span>
                <span className={`px-2 py-1 rounded text-xs ${
                  correction.confidence === 'HIGH' ? 'bg-success-100 text-success-700' :
                  correction.confidence === 'MEDIUM' ? 'bg-warning-100 text-warning-700' :
                  'bg-error-100 text-error-700'
                }`}>
                  {correction.confidence}
                </span>
              </div>
              <div className="text-gray-500 mt-1">{correction.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 🎭 Modern UX Patterns

### Loading States

```typescript
// Every interaction has a loading state
interface LoadingStateProps {
  type: 'button' | 'page' | 'section' | 'inline';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  type, 
  message = 'Loading...', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  const spinnerClasses = `${sizeClasses[size]} border-2 border-current border-t-transparent rounded-full animate-spin`;
  
  switch (type) {
    case 'button':
      return <div className={spinnerClasses} />;
      
    case 'inline':
      return (
        <div className="flex items-center space-x-2">
          <div className={spinnerClasses} />
          <span className="text-sm text-gray-600">{message}</span>
        </div>
      );
      
    case 'section':
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className={spinnerClasses} />
          <p className="text-gray-600">{message}</p>
        </div>
      );
      
    case 'page':
      return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
          <div className={spinnerClasses} />
          <p className="text-lg text-gray-600">{message}</p>
        </div>
      );
  }
};
```

### Empty States

```typescript
// Informative empty states that guide users
interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon
}) => {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        {description}
      </p>
      
      {action && (
        <Button 
          variant="primary" 
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
```

### Error States with Recovery

```typescript
// Forgiving interactions with recovery options
interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
  onReport?: () => void;
  context?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  onReport,
  context = 'operation'
}) => {
  return (
    <div className="p-6 bg-error-50 border border-error-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-error-500 text-xl">⚠</span>
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-medium text-error-800">
            {context} failed
          </h3>
          
          <p className="text-sm text-error-700 mt-1">
            {error.message || 'An unexpected error occurred.'}
          </p>
          
          <div className="flex space-x-3 mt-4">
            {onRetry && (
              <Button
                size="sm"
                variant="error"
                onClick={onRetry}
              >
                Try again
              </Button>
            )}
            
            {onReport && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onReport}
              >
                Report issue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 🎨 Visual Polish Standards

### Smooth Transitions

```css
/* UnoCSS custom animations for smooth interactions */
@keyframes feedback {
  0% { transform: scale(1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes slide-in {
  0% { 
    opacity: 0; 
    transform: translateY(10px); 
  }
  100% { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* Consistent transition timing */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-50 { transition-duration: 50ms; }
.duration-100 { transition-duration: 100ms; }
.duration-200 { transition-duration: 200ms; }
```

### Consistent Elevation System

```typescript
// Shadow system for depth hierarchy
const elevationClasses = {
  none: '',
  subtle: 'shadow-sm',      // Level 1: Cards, inputs
  medium: 'shadow-md',      // Level 2: Dropdowns, tooltips
  high: 'shadow-lg',        // Level 3: Modals, sheets
  highest: 'shadow-xl'      // Level 4: Important overlays
};

// Interactive elevation changes
const interactiveElevation = {
  card: {
    base: 'shadow-sm',
    hover: 'shadow-md',
    active: 'shadow-sm'
  },
  button: {
    base: 'shadow-sm',
    hover: 'shadow-md',
    active: 'shadow-xs'
  }
};
```

## 🔐 Accessibility Standards

### WCAG 2.1 AA Compliance

```typescript
// Accessibility-first component development
interface AccessibleComponentProps {
  // Required accessibility props
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  
  // Keyboard navigation
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent) => void;
  
  // Screen reader support
  role?: string;
}

const AccessibleComponent: React.FC<AccessibleComponentProps> = (props) => {
  // Ensure proper focus management
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (props.onClick) {
          e.preventDefault();
          props.onClick();
        }
        break;
      case 'Escape':
        if (props.onEscape) {
          e.preventDefault();
          props.onEscape();
        }
        break;
    }
  }, [props.onClick, props.onEscape]);
  
  return (
    <div
      role={props.role}
      tabIndex={props.tabIndex}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-expanded={props['aria-expanded']}
      aria-hidden={props['aria-hidden']}
      onKeyDown={handleKeyDown}
      className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      {props.children}
    </div>
  );
};
```

### Focus Management System

```typescript
// Proper focus management for complex interfaces
class FocusManager {
  private focusStack: HTMLElement[] = [];
  
  trapFocus(container: HTMLElement): void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }
  
  pushFocus(element: HTMLElement): void {
    this.focusStack.push(document.activeElement as HTMLElement);
    element.focus();
  }
  
  popFocus(): void {
    const previousElement = this.focusStack.pop();
    if (previousElement) {
      previousElement.focus();
    }
  }
}
```

## 📊 Real-time Feedback Systems

### Cleaning Confidence Visualization

```typescript
// Real-time confidence indicators for cleaning system
interface ConfidenceIndicatorProps {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  animated = true,
  size = 'md'
}) => {
  const confidenceConfig = {
    HIGH: {
      color: 'bg-confidence-high',
      width: 'w-full',
      text: 'High confidence',
      icon: '✓'
    },
    MEDIUM: {
      color: 'bg-confidence-medium',
      width: 'w-3/4',
      text: 'Medium confidence',
      icon: '◐'
    },
    LOW: {
      color: 'bg-confidence-low',
      width: 'w-1/2',
      text: 'Low confidence',
      icon: '⚠'
    }
  };
  
  const config = confidenceConfig[confidence];
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center space-x-1">
          <span>{config.icon}</span>
          <span>{config.text}</span>
        </span>
        <span className="font-medium">{confidence}</span>
      </div>
      
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div 
          className={`${config.color} ${sizeClasses[size]} rounded-full ${
            animated ? 'transition-all duration-500 ease-out' : ''
          } ${config.width}`}
        />
      </div>
    </div>
  );
};
```

### Real-time Correction Display

```typescript
// Show corrections as they happen
interface CorrectionHighlightProps {
  original: string;
  corrected: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

const CorrectionHighlight: React.FC<CorrectionHighlightProps> = ({
  original,
  corrected,
  confidence,
  reason
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const confidenceClasses = {
    HIGH: 'bg-success-100 text-success-800 border-success-200',
    MEDIUM: 'bg-warning-100 text-warning-800 border-warning-200',
    LOW: 'bg-error-100 text-error-800 border-error-200'
  };
  
  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span 
        className={`px-1 py-0.5 rounded border-b-2 border-dashed cursor-help ${
          confidenceClasses[confidence]
        }`}
      >
        {corrected}
      </span>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
          <div className="font-medium">"{original}" → "{corrected}"</div>
          <div className="text-gray-300">{reason}</div>
          <div className="text-gray-400">Confidence: {confidence}</div>
        </div>
      )}
    </span>
  );
};
```

## 🧪 Design System Testing

### Component Testing Standards

```typescript
// Every component must pass these accessibility and interaction tests
describe('Component Accessibility & Interaction Tests', () => {
  test('should have proper ARIA labels', () => {
    render(<TestComponent aria-label="Test component" />);
    expect(screen.getByLabelText('Test component')).toBeInTheDocument();
  });
  
  test('should be keyboard navigable', () => {
    render(<TestComponent />);
    const component = screen.getByRole('button');
    
    component.focus();
    expect(component).toHaveFocus();
    
    fireEvent.keyDown(component, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalled();
  });
  
  test('should provide sub-100ms visual feedback', async () => {
    render(<TestComponent />);
    const component = screen.getByRole('button');
    
    const startTime = performance.now();
    fireEvent.mouseDown(component);
    
    // Check that visual feedback is immediate
    await waitFor(() => {
      const feedbackTime = performance.now() - startTime;
      expect(feedbackTime).toBeLessThan(100);
      expect(component).toHaveClass('scale-95'); // Visual feedback class
    });
  });
  
  test('should meet color contrast requirements', () => {
    render(<TestComponent />);
    const component = screen.getByRole('button');
    
    // Use axe-core to check contrast ratios
    expect(component).toHaveStyle({
      // Ensure 4.5:1 contrast ratio for normal text
      // Ensure 3:1 contrast ratio for large text
    });
  });
});
```

---

This design system ensures every component follows the reconnaissance-first approach, maintains consistency, delivers sub-100ms feedback, and provides an exceptional user experience through progressive disclosure and modern UX patterns.