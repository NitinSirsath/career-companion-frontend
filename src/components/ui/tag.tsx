import * as React from 'react';
import type { TagColor } from '../../lib/statusTags';
import { cn } from '../../lib/utils';

const COLORS: Record<TagColor, string> = {
  gray: 'bg-tag-gray-bg text-tag-gray shadow-[inset_0_0_0_1px_var(--tag-gray-ring)]',
  blue: 'bg-tag-blue-bg text-tag-blue shadow-[inset_0_0_0_1px_var(--tag-blue-ring)]',
  cyan: 'bg-tag-cyan-bg text-tag-cyan shadow-[inset_0_0_0_1px_var(--tag-cyan-ring)]',
  teal: 'bg-tag-teal-bg text-tag-teal shadow-[inset_0_0_0_1px_var(--tag-teal-ring)]',
  green: 'bg-tag-green-bg text-tag-green shadow-[inset_0_0_0_1px_var(--tag-green-ring)]',
  red: 'bg-tag-red-bg text-tag-red shadow-[inset_0_0_0_1px_var(--tag-red-ring)]',
  yellow: 'bg-tag-yellow-bg text-tag-yellow shadow-[inset_0_0_0_1px_var(--tag-yellow-ring)]',
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
        // A pill with a thin ring and a small dot (owner, 3 Nov 2026).
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] leading-4 font-medium whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        COLORS[color],
        className,
      )}
      {...props}
    />
  );
}
