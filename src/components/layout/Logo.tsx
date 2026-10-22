import { cn } from '../../lib/utils';

/** The app's mark: a blue square with three lines. */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect x="1" y="1" width="20" height="20" className="fill-border-interactive" />
      <path d="M6 8h10M6 11h10M6 14h6" stroke="#ffffff" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
