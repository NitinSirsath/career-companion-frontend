import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * One section of a settings page: the title and a short help above, the controls under them in a
 * card across the full width. Sections are spaced apart, with no line between them.
 */
export function SettingsSection({
  title,
  help,
  children,
  className,
}: {
  title: string;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-3 pt-10 first-of-type:pt-2', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base leading-[22px] font-semibold">
          {title}
        </h2>
        {help && <div className="text-sm text-text-secondary">{help}</div>}
      </div>
      <div className="flex min-w-0 flex-col gap-4 border border-border-subtle bg-surface px-6 py-5">
        {children}
      </div>
    </section>
  );
}

/** Facts as label and value, the way settings show them. */
export function FactList({ facts }: { facts: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {facts.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="text-text-secondary">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
