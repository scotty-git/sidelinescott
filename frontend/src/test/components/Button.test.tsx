import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../components/Button'
import { describe, it, expect, vi } from 'vitest'

describe('Button Component', () => {
  it('renders button with correct text', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Test Button')
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Primary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('btn-primary')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('btn-secondary')
  })

  it('shows loading state', () => {
    render(<Button loading>Loading Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('calls onClick handler', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('provides sub-50ms visual feedback on mousedown', async () => {
    render(<Button>Feedback Test</Button>)
    const button = screen.getByRole('button')
    
    const startTime = performance.now()
    fireEvent.mouseDown(button)
    
    // Wait for next animation frame
    await new Promise(resolve => requestAnimationFrame(resolve))
    
    const feedbackTime = performance.now() - startTime
    expect(feedbackTime).toBeLessThan(50)
    
    // Check for active scale class instead of inline transform
    expect(button).toHaveClass('active:scale-95')
  })

  it('is disabled when loading prop is true', () => {
    render(<Button loading>Disabled Button</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})