import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline' | 'secondary';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        {
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
          'border-transparent bg-[#e6f4ea] text-[#1e8e3e] dark:bg-[#1e8e3e]/20 dark:text-[#81c995]': variant === 'success',
          'border-transparent bg-[#fef7e0] text-[#b06000] dark:bg-[#f29900]/20 dark:text-[#fde293]': variant === 'warning',
          'border-transparent bg-[#fce8e6] text-[#c5221f] dark:bg-[#c5221f]/20 dark:text-[#fad2cf]': variant === 'destructive',
          'border-transparent bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1967d2]/20 dark:text-[#aecbfa]': variant === 'info',
          'border-border text-foreground': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
