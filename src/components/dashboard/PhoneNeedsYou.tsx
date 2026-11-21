import type { ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRightIcon, ClockIcon } from 'lucide-react';
import type { DashboardResponse } from '../../contracts/dashboard';
import { cn } from '../../lib/utils';
import { Ring } from '../ui/ring';
import { interviewLine, needsActionLine, newMailsLine } from './needsLines';
import { PHONE_HEADING } from './PhoneSection';

const TILE =
  'flex min-w-0 flex-col rounded-2xl bg-surface-subtle px-3.5 pt-3 pb-3.5 text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0';

/**
 * One "Needs you" tile: its mark and a chevron, the count, the name and one line. The name comes
 * first for screen readers; the count shows first.
 */
function NeedTile({
  mark,
  label,
  count,
  line,
  link,
  lead = false,
}: {
  mark: ReactNode;
  label: string;
  count: number;
  line: ReactNode;
  link?: LinkProps;
  /** The first tile: full width, a bigger number. */
  lead?: boolean;
}) {
  const inside = (
    <>
      <span
        className={cn(
          'order-2 text-[14px] leading-[18px] font-semibold',
          lead && 'text-phone-row font-semibold',
        )}
      >
        {label}
      </span>
      <span
        key={count}
        className={cn(
          'order-1 mt-2.5 animate-count-in text-[30px] leading-9 font-bold tracking-[-0.02em] tabular-nums',
          lead && 'mt-3.5 text-[44px] leading-[48px]',
          count === 0 && 'text-text-tertiary',
        )}
      >
        {count}
      </span>
      <span className="order-3 mt-[3px] text-[12.5px] leading-4 text-text-secondary">{line}</span>
      <span className="order-first flex h-[18px] items-center justify-between" aria-hidden="true">
        <span className="flex w-[15px] justify-center">{mark}</span>
        {link && <ChevronRightIcon size={14} className="text-text-tertiary" />}
      </span>
    </>
  );
  const className = cn(TILE, lead && 'col-span-2 px-4 pt-3.5 pb-4');
  if (!link) return <div className={cn(className, 'active:bg-surface-subtle')}>{inside}</div>;
  return (
    <Link {...link} className={className}>
      {inside}
    </Link>
  );
}

/**
 * "Needs you" on the phone's Today (owner, 21 Nov 2026, mock `DASHBOARD-PHONE-mock/` look B): the
 * first thing seen, so it leads. Mails to act on in one big tile, new job mails and interviews
 * coming up in two under it, each with one line.
 */
export function PhoneNeedsYou({ now }: { now: DashboardResponse['now'] }) {
  const next = now.interviews.next;
  return (
    <section aria-labelledby="needs-you" className="pt-3">
      <h2 id="needs-you" className={cn(PHONE_HEADING, 'px-[18px] pb-1.5')}>
        Needs you
      </h2>
      <div className="grid grid-cols-2 gap-2 px-[18px] pt-0.5">
        <NeedTile
          lead
          mark={<Ring kind="interview" />}
          label="Needs action"
          count={now.needsAction.count}
          line={needsActionLine(now.needsAction)}
          link={{ to: '/mails', search: { request: 'open' } }}
        />
        <NeedTile
          mark={
            now.newJobMails.count > 0 && <span className="size-2 rounded-full bg-action-primary" />
          }
          label="New job mails"
          count={now.newJobMails.count}
          line={newMailsLine(now.newJobMails)}
          link={{ to: '/mails', search: { unseen: true } }}
        />
        <NeedTile
          mark={<ClockIcon size={16} className="text-text-secondary" />}
          label="Interviews coming up"
          count={now.interviews.count}
          line={interviewLine(now.interviews, false)}
          link={next ? { to: '/mails/$key', params: { key: next.conversationKey } } : undefined}
        />
      </div>
    </section>
  );
}
