import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline' | 'secondary';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2",
        {
          'border-transparent bg-action-primary text-text-inverse': variant === 'default',
          'border-transparent bg-action-secondary text-text-primary': variant === 'secondary',
          'border-transparent bg-status-success-subtle text-status-success': variant === 'success',
          'border-transparent bg-status-warning-subtle text-status-warning': variant === 'warning',
          'border-transparent bg-status-error-subtle text-status-error': variant === 'destructive',
          'border-transparent bg-status-info-subtle text-status-info': variant === 'info',
          'border-border-default text-text-primary': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
