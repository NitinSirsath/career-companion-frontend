import * as React from 'react';
import type { TagColor } from '../../lib/statusTags';
import { cn } from '../../lib/utils';

const COLORS: Record<TagColor, string> = {
  gray: 'bg-tag-gray-bg text-tag-gray',
  blue: 'bg-tag-blue-bg text-tag-blue',
  cyan: 'bg-tag-cyan-bg text-tag-cyan',
  teal: 'bg-tag-teal-bg text-tag-teal',
  green: 'bg-tag-green-bg text-tag-green',
  red: 'bg-tag-red-bg text-tag-red',
  yellow: 'bg-tag-yellow-bg text-tag-yellow',
  outline: 'bg-transparent text-text-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]',
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
}

/** A small label for a status or a count. Pick the colour from `lib/statusTags.ts`, not by hand. */
export function Tag({ className, color = 'gray', ...props }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 px-2 text-[12px] leading-4 font-medium whitespace-nowrap',
        COLORS[color],
        className,
      )}
      {...props}
    />
  );
}
