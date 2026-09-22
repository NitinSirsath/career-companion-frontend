import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    
    // Map legacy variants
    if (variant === 'default') variant = 'primary';
    if (variant === 'outline') variant = 'tertiary';

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-none text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-border-subtle",
          {
            'bg-action-primary text-text-inverse hover:bg-action-primary-hover': variant === 'primary',
            'bg-action-secondary text-text-primary hover:bg-action-secondary-hover': variant === 'secondary',
            'border border-border-default bg-transparent hover:bg-surface-subtle hover:text-text-primary': variant === 'tertiary',
            'hover:bg-surface-subtle hover:text-text-primary bg-transparent text-text-secondary': variant === 'ghost',
            'bg-action-danger text-text-inverse hover:bg-action-danger-hover': variant === 'danger',
            'h-10 px-4 py-2': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-12 px-8': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
