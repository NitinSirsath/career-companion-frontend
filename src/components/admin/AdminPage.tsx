import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useAdminOverview, useFreeAIMoney } from '../../api/admin';
import type { AdminFreeAIMoney, AdminOverview } from '../../contracts/admin';
import {
  accountCounts,
  count,
  dayLabel,
  moneyLow,
  needsALook,
  usd,
  type LookItem,
} from '../../lib/admin';
import { cn } from '../../lib/utils';
import { PageHeader } from '../layout/PageHeader';
import { usePhoneNav } from '../phone/phoneNav';
import { PhoneRefreshCapsule } from '../phone/PhoneRefresh';
import { Ring } from '../ui/ring';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { AdminAccounts, ResumeButton } from './AdminAccounts';
import { AdminInvites } from './AdminInvites';
import { AdminMessages } from './AdminMessages';
import { PhoneAdmin } from './PhoneAdmin';

/** A small grey heading over a part of the page (laptop v2, owner 18 Nov 2026). */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <h2 className="mt-5 mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-text-secondary first:mt-0">
      {title}
      {note && <span className="font-medium">{note}</span>}
    </h2>
  );
}

/** The four numbers in one line between two thin lines, instead of tiles (laptop v2). */
function Numbers({ overview }: { overview: AdminOverview }) {
  const counts = accountCounts(overview.accounts);
  const limit = overview.betaUserLimit;
  const callsToday = overview.aiCallsByDay[overview.aiCallsByDay.length - 1]?.calls ?? 0;
  const numbers: { label: string; value: ReactNode; note: string }[] = [
    {
      label: 'Accounts',
      value: (
        <>
          {count(counts.real)}
          {limit > 0 && (
            <span className="text-sm font-medium text-text-tertiary"> / {count(limit)}</span>
          )}
        </>
      ),
      note:
        limit > 0 ? `${count(Math.max(0, limit - counts.real))} beta places left` : 'No beta limit',
    },
    {
      label: 'Gmail connected',
      value: count(counts.gmailConnected),
      note: `of ${count(counts.real)} accounts`,
    },
    {
      label: 'New this week',
      value: count(counts.newThisWeek),
      note: `${count(counts.newToday)} today`,
    },
    { label: 'AI calls today', value: count(callsToday), note: 'All accounts, UTC day' },
  ];
  return (
    <dl className="grid grid-cols-4 border-y border-border-subtle">
      {numbers.map((number) => (
        // "41 / 99" over "Accounts · 58 beta places left", as the mock draws it.
        <div
          key={number.label}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-1 py-3 text-[13px]"
        >
          <dt className="row-start-2 text-text-secondary">{number.label}</dt>
          <dd className="col-span-2 row-start-1 text-[22px] leading-7 font-semibold tracking-[-0.015em] tabular-nums">
            {number.value}
          </dd>
          <dd className="row-start-2 truncate text-text-tertiary before:mr-1 before:content-['·']">
            {number.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One thing to look at: a ring, its title and grey detail, and Resume for a resume request. */
function LookRow({ item }: { item: LookItem }) {
  return (
    <li className="flex items-start gap-3 border-b border-border-subtle px-2.5 py-2.5 text-sm">
      {/* An empty ring for a request to answer, a grey × ring for a problem (laptop v2). */}
      <Ring kind={item.tone === 'blue' ? 'applied' : 'closed'} size={14} className="mt-[3px]" />
      <div className="min-w-0 flex-1">
        <p className={cn(item.tone === 'red' && 'text-danger-text')}>{item.title}</p>
        <p className="leading-5 break-words text-text-secondary">{item.detail}</p>
        {item.resume && (
          <p className="mt-0.5 leading-5 break-words text-text-secondary">
            &ldquo;{item.resume.text}&rdquo;
          </p>
        )}
      </div>
      {item.resume && <ResumeButton account={item.resume.account} link />}
    </li>
  );
}

function NeedsALook({ items }: { items: LookItem[] }) {
  if (!items.length)
    return (
      <p className="border-b border-border-subtle px-2.5 py-2.5 text-sm text-text-secondary">
        All good. No paused AI, failing syncs, unread mails, key problems or limits reached.
      </p>
    );
  return (
    <ul>
      {items.map((item) => (
        <LookRow key={item.key} item={item} />
      ))}
    </ul>
  );
}

const CHART_MAX_STEPS = [500, 1000, 1500, 2500, 5000, 10000, 25000, 50000, 100000];

type ChartDays = AdminOverview['aiCallsByDay'];
type Geometry = ReturnType<typeof chartGeometry>;

/** Sizes and the scale: the top line is the next round number over the busiest day. */
function chartGeometry(days: ChartDays, phone: boolean) {
  const width = phone ? 337 : 960;
  const height = phone ? 140 : 170;
  const left = phone ? 34 : 44;
  const top = 6;
  const plotHeight = height - 22 - top;
  const highest = Math.max(...days.map((day) => day.calls), 1);
  const max = CHART_MAX_STEPS.find((step) => step >= highest) ?? Math.ceil(highest / 1000) * 1000;
  const slot = (width - left) / days.length;
  return {
    width,
    height,
    left,
    top,
    plotHeight,
    max,
    slot,
    barWidth: Math.min(phone ? 14 : 28, slot - 6),
    labelEvery: phone ? 4 : 2,
    y: (value: number) => top + plotHeight - (value / max) * plotHeight,
  };
}

const dayName = (days: ChartDays, index: number) =>
  index === days.length - 1 ? 'Today' : dayLabel(`${days[index].day}T12:00:00Z`);

function ChartGrid({ g }: { g: Geometry }) {
  return [0, g.max / 3, (g.max * 2) / 3, g.max].map((line) => (
    <g key={line}>
      <line
        x1={g.left}
        x2={g.width}
        y1={g.y(line)}
        y2={g.y(line)}
        className={line ? 'stroke-border-subtle' : 'stroke-border-default'}
      />
      <text
        x={g.left - 8}
        y={g.y(line) + 4}
        textAnchor="end"
        className="fill-text-tertiary text-[11px] tabular-nums"
      >
        {count(Math.round(line))}
      </text>
    </g>
  ));
}

/** One day: a bar with round top corners on the base line, a wide hover area and its label. */
function ChartBar({
  g,
  days,
  index,
  hovered,
  onHover,
}: {
  g: Geometry;
  days: ChartDays;
  index: number;
  hovered: boolean;
  onHover: (index: number | null) => void;
}) {
  const calls = days[index].calls;
  const base = g.top + g.plotHeight;
  const x = g.left + g.slot * index + (g.slot - g.barWidth) / 2;
  const barTop = g.y(calls);
  const r = Math.min(4, (base - barTop) / 2);
  const right = x + g.barWidth;
  return (
    <g onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      <rect
        x={g.left + g.slot * index}
        y={g.top}
        width={g.slot}
        height={g.plotHeight}
        className="fill-transparent"
      />
      {calls > 0 && (
        <path
          d={`M${x},${base} V${barTop + r} Q${x},${barTop} ${x + r},${barTop} H${right - r} Q${right},${barTop} ${right},${barTop + r} V${base} Z`}
          className={cn(
            'fill-link',
            index === days.length - 1 && 'opacity-55',
            hovered && 'opacity-100 brightness-110',
          )}
        />
      )}
      {(days.length - 1 - index) % g.labelEvery === 0 && (
        <text
          x={g.left + g.slot * index + g.slot / 2}
          y={g.height - 6}
          textAnchor="middle"
          className="fill-text-tertiary text-[11px]"
        >
          {dayName(days, index)}
        </text>
      )}
    </g>
  );
}

/** AI calls per day, one bar a day; today's bar is lighter because the day is not over. */
export function CallsChart({ days }: { days: ChartDays }) {
  const phone = !!usePhoneNav();
  const [hover, setHover] = useState<number | null>(null);
  const g = chartGeometry(days, phone);
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`AI calls per day, last ${days.length} days`}
      >
        <ChartGrid g={g} />
        {days.map((day, index) => (
          <ChartBar
            key={day.day}
            g={g}
            days={days}
            index={index}
            hovered={hover === index}
            onHover={setHover}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute -top-2 rounded-lg bg-[#18181b] px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-popup"
          style={{
            left: `${((g.left + g.slot * hover + g.slot / 2) / g.width) * 100}%`,
            translate: '-50% -100%',
          }}
        >
          {hover === days.length - 1 ? 'Today (so far)' : dayName(days, hover)}:{' '}
          {count(days[hover].calls)} AI calls
        </div>
      )}
    </div>
  );
}

/** "Today $0.42 · This month $3.10 · Left $6.18 of $10.00", with a bar when the key has a limit. */
export function MoneyLine({
  money,
  loading,
}: {
  money: AdminFreeAIMoney | undefined;
  loading: boolean;
}) {
  let body: ReactNode;
  if (loading) body = <span className="text-text-tertiary">Checking OpenRouter…</span>;
  else if (!money || money.state === 'UNAVAILABLE')
    body = (
      <span className="text-text-secondary">Could not check OpenRouter. Refresh to try again.</span>
    );
  else if (money.state === 'NO_KEY')
    body = <span className="text-text-secondary">The free AI key is not set.</span>;
  else {
    const low = moneyLow(money);
    const share =
      money.limitUsd && money.leftUsd !== null
        ? Math.max(0, Math.min(1, money.leftUsd / money.limitUsd))
        : null;
    body = (
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 tabular-nums">
        <span>
          <span className="text-text-tertiary">Today</span>{' '}
          <b className="font-semibold">{usd(money.todayUsd)}</b>
        </span>
        <span>
          <span className="text-text-tertiary">This month</span>{' '}
          <b className="font-semibold">{usd(money.monthUsd)}</b>
        </span>
        {money.leftUsd !== null && money.limitUsd !== null && (
          <>
            <span>
              <span className="text-text-tertiary">Left</span>{' '}
              <b className={cn('font-semibold', low && 'text-tag-yellow')}>{usd(money.leftUsd)}</b>{' '}
              <span className="text-text-tertiary">of {usd(money.limitUsd)}</span>
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-selected"
            >
              <span
                className={cn('block h-full rounded-full', low ? 'bg-tag-yellow' : 'bg-ok')}
                style={{ width: `${(share ?? 0) * 100}%` }}
              />
            </span>
          </>
        )}
      </span>
    );
  }
  return (
    <section aria-label="Free AI money" className="panel p-3.5 text-sm">
      <h2 className="mb-2 text-xs font-semibold text-text-secondary">Free AI on OpenRouter</h2>
      {body}
    </section>
  );
}

/**
 * The Admin page (owner, 18 Nov 2026, approved mock `ADMIN-PANEL-mock/`): how full the beta is,
 * what needs a look, every account with Suspend and Resume, and AI use with the free AI money.
 * Account facts and counts only, never anyone's mail. Only for ADMIN_EMAILS.
 */
export function AdminPage() {
  const phone = !!usePhoneNav();
  const overview = useAdminOverview();
  const money = useFreeAIMoney();
  const data = overview.data;
  let body: ReactNode;
  if (overview.isLoading) body = <SkeletonList rows={4} label="Loading the Admin page" />;
  else if (overview.error || !data)
    body = (
      <SectionError title="Could not load the Admin page" onRetry={() => void overview.refetch()} />
    );
  else if (phone) body = <PhoneAdmin overview={data} />;
  else {
    const items = needsALook(data, money.data);
    body = (
      <>
        <Numbers overview={data} />
        {/* Laptop v2 (18 Nov 2026): the lists on the left, Messages and the money on the right. */}
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-8">
          <div className="min-w-0">
            <SectionTitle
              title="Needs a look"
              note={items.length ? `· ${items.length}` : undefined}
            />
            <NeedsALook items={items} />
            <SectionTitle
              title="Accounts"
              note={(() => {
                const counts = accountCounts(data.accounts);
                return `· ${count(data.accounts.length)}${counts.test ? ` (${counts.test} test ${counts.test === 1 ? 'account' : 'accounts'} not counted)` : ''}`;
              })()}
            />
            <AdminAccounts accounts={data.accounts} />
            <AdminInvites />
            <SectionTitle title="AI use" note="· AI calls per day, all accounts, last 14 days" />
            <CallsChart days={data.aiCallsByDay} />
            <p className="mt-2 text-xs leading-[18px] text-text-tertiary">
              Today&rsquo;s bar is lighter: the day is not over. Days are UTC days, like the AI
              daily limits.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:sticky lg:top-20">
            <AdminMessages accounts={data.accounts} />
            <MoneyLine money={money.data} loading={money.isLoading} />
          </div>
        </div>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PhoneRefreshCapsule />
      <PageHeader
        phoneSmallTitle
        className={phone ? 'mb-2' : 'mb-0'}
        title="Admin"
        description={
          phone
            ? "Only you see this. Counts only, never anyone's mail."
            : "Only you see this page. Account facts and counts, never anyone's mail."
        }
        refresh
        actions={
          data &&
          !phone && (
            <span className="text-xs text-text-secondary">
              Updated {format(new Date(data.generatedAt), 'h:mm a')}
            </span>
          )
        }
      />
      {body}
    </div>
  );
}
