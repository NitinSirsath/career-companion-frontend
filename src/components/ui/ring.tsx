import type { ApplicationStatus } from '../../contracts/application';
import { statusTag, type RingKind, type StatusLook } from '../../lib/statusTags';
import { cn } from '../../lib/utils';

/** How much of the ring is filled in, and its colour. */
const LOOK: Record<RingKind, { color: string; share: number }> = {
  applied: { color: 'text-ring-grey', share: 0 },
  recruiter: { color: 'text-ring-recruiter', share: 0.25 },
  assessment: { color: 'text-ring-assessment', share: 0.5 },
  interview: { color: 'text-ring-interview', share: 0.75 },
  offer: { color: 'text-ring-offer', share: 1 },
  closed: { color: 'text-ring-grey', share: 0 },
  todo: { color: 'text-text-secondary', share: 0 },
};

/** The filled part, clockwise from the top: a slice of a circle of radius 4 inside the ring. */
function slice(share: number) {
  const angle = share * 2 * Math.PI;
  const x = 8 + 4 * Math.sin(angle);
  const y = 8 - 4 * Math.cos(angle);
  return `M8 8V4A4 4 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}Z`;
}

function Inside({ kind, share }: { kind: RingKind; share: number }) {
  if (kind === 'offer')
    return (
      <path
        d="M5 8.3 7.1 10.4 11 6.1"
        fill="none"
        stroke="var(--background)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  if (kind === 'closed')
    return (
      <path
        d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  return share > 0 ? <path d={slice(share)} fill="currentColor" /> : null;
}

/**
 * The status ring (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`): one small ring in place of a
 * coloured status label, phone and laptop. Applied is an empty grey ring, Recruiter contact a
 * quarter blue, Assessment half yellow, Interview three quarters orange, Offer a green check,
 * Rejected and Closed a grey ×. `todo`: a to-do's empty ring. Decorative unless given a `label`.
 * Sizes from the mocks: 15 in phone rows, 12 on a photo, 17 in sheets and to-dos, 14 on laptops.
 */
export function Ring({
  kind,
  size = 15,
  label,
  className,
}: {
  kind: RingKind;
  size?: number;
  /** What it means, when no words sit next to it: "Interview". */
  label?: string;
  className?: string;
}) {
  const { color, share } = LOOK[kind];
  const filled = kind === 'offer';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-ring={kind}
      className={cn('shrink-0', color, className)}
    >
      <circle
        cx="8"
        cy="8"
        r={filled ? 8 : 7.1}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={1.8}
      />
      <Inside kind={kind} share={share} />
    </svg>
  );
}

/** A status as words with its ring in front: "◕ Interview". */
export function StatusRing({
  look,
  size = 14,
  className,
}: {
  look: StatusLook;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap', className)}>
      <Ring kind={look.ring} size={size} />
      {look.label}
    </span>
  );
}

/** An application status as ring + words. A missing status reads "Status unknown". */
export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus | null;
  className?: string;
}) {
  return <StatusRing look={statusTag(status)} className={className} />;
}
