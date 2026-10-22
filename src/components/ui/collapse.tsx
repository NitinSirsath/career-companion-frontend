import type * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { cn } from '../../lib/utils';

/**
 * A section that shows and hides: it grows from no height to its own and fades in over 240ms,
 * and leaves the same way, so the content below moves instead of jumping. The button that opens
 * it stays with the caller and keeps its `aria-expanded`.
 */
export function Collapse({
  open,
  id,
  className,
  children,
}: {
  open: boolean;
  /** For the toggle's `aria-controls`. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root open={open}>
      <Collapsible.Panel
        id={id}
        className={cn(
          'h-(--collapsible-panel-height) overflow-clip [overflow-clip-margin:4px] transition-[height,opacity] duration-240 ease-standard data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0',
          className,
        )}
      >
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
