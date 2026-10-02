import * as React from "react"
import { cn } from "../../lib/utils"

/** Styled native <select>: keyboard and screen-reader behavior come from the platform. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-none border border-border-default bg-surface px-3 py-2 text-sm text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-disabled",
        className
      )}
      {...props}
    />
  )
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
