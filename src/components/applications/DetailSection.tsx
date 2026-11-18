import { useId, type ReactNode } from 'react';

/**
 * A section of an application page on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`
 * screen 6): a bold heading with a grey count, plain rows under it, and its help as a small note.
 */
export function DetailSection({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="-mx-4 pt-1 pb-3">
      <div className="flex items-baseline gap-2 px-[18px] pt-1 pb-2">
        <h2 id={id} className="text-phone-heading">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[14px] font-medium text-text-tertiary">{count}</span>
        )}
      </div>
      {children}
      {note && (
        <p className="px-[18px] pt-1.5 text-[13px] leading-[18px] text-text-tertiary">{note}</p>
      )}
    </section>
  );
}

/** A plain row on an application page: 18px sides, darker while pressed. */
export const DETAIL_ROW =
  'flex w-full items-center gap-[11px] px-[18px] text-left text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0';

/** A fact on a phone's application page: a pill in the page's round card (mock screen 6). */
export const PILL =
  'inline-flex h-[31px] items-center gap-1.5 rounded-full bg-layer-accent px-3 text-[14px] font-medium whitespace-nowrap text-text-primary';
