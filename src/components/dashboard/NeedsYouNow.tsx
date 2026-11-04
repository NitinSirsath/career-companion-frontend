import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Calendar, Email, Task, type CarbonIconType } from '@carbon/icons-react';
import type { DashboardResponse } from '../../contracts/dashboard';
import { interviewWhen } from '../../lib/dashboard';
import { cn } from '../../lib/utils';

type Now = DashboardResponse['now'];

const TILE =
  'grid grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 rounded-lg bg-surface-subtle px-4 py-3.5 @min-[600px]:row-span-3 @min-[600px]:grid-cols-[minmax(0,1fr)_16px] @min-[600px]:grid-rows-subgrid @min-[600px]:items-start @min-[600px]:p-5 @min-[900px]:p-6';

/**
 * One tile: the name with a blue dot when it holds something, the number, and one line. Phones
 * show a row with the number on the right; wider pages a tile with a big number.
 */
function Tile({
  icon: Icon,
  label,
  count,
  line,
  to,
}: {
  icon: CarbonIconType;
  label: string;
  count: number;
  line: ReactNode;
  to?: (children: ReactNode, className: string) => ReactNode;
}) {
  const body = (
    <>
      <span className="col-start-1 row-start-1 flex items-center gap-2 font-medium">
        <Icon size={16} aria-hidden className="shrink-0 text-text-secondary" />
        {label}
        {count > 0 && (
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-action-primary" />
        )}
      </span>
      <span
        className={cn(
          'col-start-2 row-span-2 row-start-1 text-[32px] leading-10 font-light tracking-[-0.02em] @min-[600px]:col-span-2 @min-[600px]:col-start-1 @min-[600px]:row-span-1 @min-[600px]:row-start-2 @min-[600px]:mt-4 @min-[600px]:text-[44px] @min-[600px]:leading-[52px] @min-[900px]:text-[60px] @min-[900px]:leading-[68px]',
          count === 0 && 'text-text-tertiary',
        )}
      >
        {count}
      </span>
      <span className="col-start-1 row-start-2 pl-6 text-xs text-text-secondary @min-[600px]:col-span-2 @min-[600px]:row-start-3 @min-[600px]:mt-1 @min-[600px]:pl-0">
        {line}
      </span>
      {to && (
        <ArrowRight
          size={16}
          aria-hidden
          className="col-start-3 row-span-2 row-start-1 text-text-secondary @min-[600px]:col-start-2 @min-[600px]:row-span-1 @min-[600px]:mt-0.5"
        />
      )}
    </>
  );
  return to ? (
    to(body, cn(TILE, 'transition-colors duration-70 ease-standard hover:bg-layer-accent'))
  ) : (
    <div className={TILE}>{body}</div>
  );
}

const Strong = ({ children }: { children: ReactNode }) => (
  <strong className="font-medium text-text-primary">{children}</strong>
);

function newMailsLine({ count, today }: Now['newJobMails']) {
  if (!count) return 'You have opened every job mail';
  if (!today) return 'Not opened yet';
  return (
    <>
      <Strong>{today} today</Strong> · not opened yet
    </>
  );
}

function needsActionLine({ count, waitingOverADay }: Now['needsAction']) {
  if (!count) return 'Nothing is waiting on you';
  if (!waitingOverADay) return 'Answer them, or mark them done';
  return (
    <>
      <Strong>{waitingOverADay}</Strong> waiting over a day
    </>
  );
}

function interviewLine({ next }: Now['interviews']) {
  if (!next) return 'No interviews booked yet';
  return (
    <>
      Next: <Strong>{interviewWhen(next)}</Strong>
      {next.companyName && ` · ${next.companyName}`}
    </>
  );
}

/**
 * "Needs you now" (owner, 3 Nov 2026): what the user should look at first, whatever the period.
 * Each tile opens the matching place on Mails.
 */
export function NeedsYouNow({ now }: { now: Now }) {
  const next = now.interviews.next;
  return (
    <div className="grid gap-2 @min-[600px]:grid-cols-3 @min-[600px]:grid-rows-[auto_auto_auto] @min-[600px]:gap-y-0">
      <Tile
        icon={Email}
        label="New job mails"
        count={now.newJobMails.count}
        line={newMailsLine(now.newJobMails)}
        to={(children, className) => (
          <Link to="/mails" search={{ unseen: true }} className={className}>
            {children}
          </Link>
        )}
      />
      <Tile
        icon={Task}
        label="Needs action"
        count={now.needsAction.count}
        line={needsActionLine(now.needsAction)}
        to={(children, className) => (
          <Link to="/mails" search={{ request: 'open' }} className={className}>
            {children}
          </Link>
        )}
      />
      <Tile
        icon={Calendar}
        label="Interviews coming up"
        count={now.interviews.count}
        line={interviewLine(now.interviews)}
        to={
          next
            ? (children, className) => (
                <Link to="/mails/$key" params={{ key: next.conversationKey }} className={className}>
                  {children}
                </Link>
              )
            : undefined
        }
      />
    </div>
  );
}
