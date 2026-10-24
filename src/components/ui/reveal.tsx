import type * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Something that appears by itself, such as an error under a field: it grows in and fades in
 * over 240ms, so a dialog or form moves instead of jumping. Render it only while it is shown.
 */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid animate-reveal', className)}>
      {/* Clips the growing content, but leaves room for focus rings at the edges. `min-w-0`: a
          long line that does not wrap is cut short instead of widening its container. */}
      <div className="min-h-0 min-w-0 overflow-clip [overflow-clip-margin:4px]">{children}</div>
    </div>
  );
}
