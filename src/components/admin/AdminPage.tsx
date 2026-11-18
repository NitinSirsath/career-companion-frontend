import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { CircleCheckIcon, MailIcon, TriangleAlertIcon } from 'lucide-react';
import { useAdminOverview, useFreeAIMoney } from '../../api/admin';
import type { AdminFreeAIMoney, AdminOverview } from '../../contracts/admin';
import {
  accountCounts,
  count,
  dayLabel,
  moneyLow,
  usd,
  type LookItem,
} from '../../lib/admin';
import { cn } from '../../lib/utils';
import { PageHeader } from '../layout/PageHeader';
import { usePhoneNav } from '../phone/phoneNav';
import { PhoneRefreshCapsule } from '../phone/PhoneRefresh';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { AdminAccounts, ResumeButton } from './AdminAccounts';

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mt-6 flex items-baseline gap-2.5 max-md:mt-4 max-md:px-1">
      <h2 className="text-base leading-[22px] font-semibold max-md:text-[17px]">{title}</h2>
      {note && <span className="text-[13px] text-text-tertiary max-md:text-[15px]">{note}</span>}
    </div>
  );
}

function Tiles({ overview }: { overview: AdminOverview }) {
  const counts = accountCounts(overview.accounts);
  const limit = overview.betaUserLimit;
  const callsToday = overview.aiCallsByDay[overview.aiCallsByDay.length - 1]?.calls ?? 0;
  const tiles: { label: string; value: ReactNode; note: string }[] = [
    {
      label: 'Accounts',
      value: (
        <>
          {count(counts.real)}
          {limit > 0 && (
            <span className="text-base font-medium tracking-normal text-text-tertiary">
              {' '}
              / {count(limit)}
            </span>
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
    <dl className="grid grid-cols-2 panel md:grid-cols-4 max-md:rounded-2xl">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={cn(
            'flex flex-col gap-1.5 border-border-subtle px-6 pt-[18px] pb-5 max-md:flex-col-reverse max-md:gap-0.5 max-md:px-4 max-md:pt-3 max-md:pb-3.5',
            index % 2 === 1 && 'border-l',
            index === 2 && 'md:border-l',
            index > 1 && 'max-md:border-t',
          )}
        >
          <dt className="text-xs text-text-secondary max-md:text-[15px]">{tile.label}</dt>
          <dd className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] tabular-nums max-md:font-bold">
            {tile.value}
          </dd>
          <dd className="text-xs text-text-tertiary max-md:hidden">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}

const TONE: Record<LookItem['tone'], string> = {
  red: 'text-danger-text',
  yellow: 'text-tag-yellow',
  blue: 'text-link',
};

function LookRow({ item }: { item: LookItem }) {
  const Icon = item.tone === 'blue' ? MailIcon : TriangleAlertIcon;
  return (
    <li className="flex gap-3.5 border-border-subtle px-6 py-3.5 text-sm not-first:border-t max-md:px-4 max-md:text-[17px] max-md:leading-[22px] md:grid md:grid-cols-[20px_260px_1fr_auto] md:items-start">
      <Icon size={18} aria-hidden="true" className={cn('mt-0.5 shrink-0', TONE[item.tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:contents">
        <b className="font-semibold max-md:font-normal">{item.title}</b>
        <div className="leading-5 break-words text-text-secondary max-md:text-[15px]">
          {item.detail}
          {item.resume && (
            <p className="mt-1.5 rounded-[10px] bg-surface px-3 py-2 text-[13px] leading-[19px] text-text-primary ring-1 ring-border-subtle ring-inset max-md:text-[15px]">
              &ldquo;{item.resume.text}&rdquo;
            </p>
          )}
        </div>
        {item.resume && (
          <div className="max-md:mt-2">
            <ResumeButton account={item.resume.account} primary />
          </div>
        )}
      </div>
    </li>
  );
}

function NeedsALook({ items }: { items: LookItem[] }) {
  if (!items.length)
    return (
      <div className="flex items-center gap-3.5 panel px-6 py-3.5 text-sm max-md:rounded-2xl max-md:px-4 max-md:text-[15px]">
        <CircleCheckIcon size={18} aria-hidden="true" className="shrink-0 text-ok" />
        All good. No paused AI, failing syncs, unread mails, key problems or limits reached.
      </div>
    );
  return (
    <ul className="panel max-md:rounded-2xl">
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
function CallsChart({ days }: { days: ChartDays }) {
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
function MoneyLine({ money, loading }: { money: AdminFreeAIMoney | undefined; loading: boolean }) {
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
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
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
              className="h-1.5 w-[180px] overflow-hidden rounded-full bg-surface-selected max-md:w-full"
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-3.5 text-sm max-md:px-4 max-md:text-[15px]">
      <span>Free AI on OpenRouter</span>
      {body}
    </div>
  );
}

/**
 * The Admin page (owner, 18 Nov 2026, approved mock `ADMIN-PANEL-mock/`): how full the beta is,
 * what needs a look, every account with Suspend and Resume, and AI use with the free AI money.
 * Account facts and counts only, never anyone's mail. Only for ADMIN_EMAILS.
 */
export function AdminPage() {
  const overview = useAdminOverview();
  const money = useFreeAIMoney();
  const data = overview.data;
  let body: ReactNode;
  if (overview.isLoading) body = <SkeletonList rows={4} label="Loading the Admin page" />;
  else if (overview.error || !data)
    body = (
      <SectionError title="Could not load the Admin page" onRetry={() => void overview.refetch()} />
    );
  else {
    const items = needsALook(data, money.data);
    body = (
      <>
        <Tiles overview={data} />
        <SectionTitle
          title="Needs a look"
          note={
            items.length ? `${items.length} ${items.length === 1 ? 'thing' : 'things'}` : undefined
          }
        />
        <NeedsALook items={items} />
        <SectionTitle
          title="Accounts"
          note={(() => {
            const counts = accountCounts(data.accounts);
            return `${count(data.accounts.length)}${counts.test ? ` · ${counts.test} test ${counts.test === 1 ? 'account' : 'accounts'} not counted` : ''}`;
          })()}
        />
        <AdminAccounts accounts={data.accounts} />
        <SectionTitle title="AI use" note="AI calls per day, all accounts, last 14 days" />
        <div className="panel max-md:rounded-2xl">
          <div className="px-6 pt-[18px] pb-4 max-md:px-3 max-md:pt-3.5 max-md:pb-2.5">
            <CallsChart days={data.aiCallsByDay} />
          </div>
          <MoneyLine money={money.data} loading={money.isLoading} />
        </div>
        <p className="m-0 text-xs leading-[18px] text-text-tertiary max-md:px-4 max-md:text-[13px]">
          Today&rsquo;s bar is lighter: the day is not over. Days are UTC days, like the AI daily
          limits.
        </p>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PhoneRefreshCapsule />
      <PageHeader
        className="mb-2"
        title="Admin"
        description="Only you see this page. Account facts and counts, never anyone's mail."
        refresh
        actions={
          data && (
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
