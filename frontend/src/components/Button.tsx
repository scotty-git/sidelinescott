import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'error'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, children, className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-50 active:scale-95'
    
    const variantClasses = {
      primary: 'btn-primary focus:ring-blue-500',
      secondary: 'btn-secondary focus:ring-neutral-500', 
      success: 'btn-success focus:ring-green-500',
      error: 'btn-error focus:ring-red-500'
    }
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    }
    
    const disabledClasses = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
    
    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <div className="loading-spinner w-4 h-4 mr-2" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'