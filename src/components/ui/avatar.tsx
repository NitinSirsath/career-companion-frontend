import { cn } from '../../lib/utils';

/** The first letters of up to two words: "Maya Chen" gives "MC". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** A circle with a person's initials. "me" is the user, on the light blue tint. */
export function Avatar({
  name,
  me = false,
  size = 'md',
  className,
}: {
  name: string;
  me?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'md' ? 'size-8 text-xs' : 'size-6 text-[11px]',
        me ? 'bg-tint text-link-hover' : 'bg-tag-gray-bg text-tag-gray',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
