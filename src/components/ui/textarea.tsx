import * as React from 'react';
import { cn } from '../../lib/utils';
import { FIELD_CLASS } from './input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(FIELD_CLASS, 'flex px-3 py-2.5', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
