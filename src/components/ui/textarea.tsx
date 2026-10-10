import * as React from 'react';
import { cn } from '../../lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex w-full rounded-none border border-border-default bg-surface px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-disabled',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
