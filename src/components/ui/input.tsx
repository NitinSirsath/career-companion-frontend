import * as React from 'react';
import { cn } from '../../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const FIELD_CLASS =
  'w-full border border-border-default bg-field text-sm text-text-primary transition-colors duration-70 ease-standard placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus aria-invalid:outline-2 aria-invalid:-outline-offset-2 aria-invalid:outline-danger-text disabled:cursor-not-allowed disabled:border-border-subtle disabled:text-text-disabled';

/** A text field: a box with a thin border on the page colour. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        FIELD_CLASS,
        'flex h-10 px-3 file:border-0 file:bg-transparent file:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
