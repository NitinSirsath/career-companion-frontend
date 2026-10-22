import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * One row of a settings page: the title and a short help on the left third, the controls on the
 * right in a card. On a phone the help sits above the card.
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
      className={cn(
        'flex flex-col gap-4 border-t border-border-subtle py-8 lg:flex-row lg:gap-12',
        className,
      )}
    >
      <div className="flex flex-col gap-2 lg:w-1/3 lg:max-w-100 lg:shrink-0">
        <h2 id={headingId} className="text-base leading-[22px] font-semibold">
          {title}
        </h2>
        {help && <div className="text-sm text-text-secondary">{help}</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 border border-border-subtle bg-surface px-6 py-5">
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
