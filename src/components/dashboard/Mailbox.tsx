import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import type { DashboardPeriod, DashboardResponse } from '../../contracts/dashboard';
import {
  PHONE_TICKS,
  axisTicks,
  jobMailsTitle,
  mailboxStats,
  pointLabel,
  pointTitle,
  seriesSpan,
} from '../../lib/dashboard';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart';
import { ChartTable } from './DashCard';

const CONFIG = {
  replyMails: { label: 'Replies from companies', color: 'var(--chart-1)' },
  interviewMails: { label: 'Interviews and tests', color: 'var(--chart-2)' },
  rejectionMails: { label: 'Rejections', color: 'var(--chart-5)' },
  otherMails: { label: 'Other job mails', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];

/** The chart's key in the page's flow, for phones: the chart's own key spills at the left edge. */
function PrintedKey() {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 pb-2 text-[12px] leading-4 text-text-secondary">
      {KEYS.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: CONFIG[key].color }}
          />
          {CONFIG[key].label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Job mails per day by kind, as stacked columns; the other days dim while one is read. The legend
 * is always printed. The phone draws the chart alone under its own heading.
 */
export function JobMailsChart({
  series,
  narrow = false,
}: {
  series: DashboardResponse['series'];
  /** On a phone: the key printed above the chart in the page's flow, and fewer dates. */
  narrow?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const data = series.points.map((point) => ({ ...point, label: pointLabel(point.start) }));
  const title = jobMailsTitle(series);
  return (
    <>
      {narrow && <PrintedKey />}
      <ChartContainer
        config={CONFIG}
        className="aspect-auto h-48 w-full @min-[600px]:h-56"
        aria-label={`${title}, by kind`}
      >
        <BarChart
          data={data}
          margin={{ left: -20, right: 0, top: 8 }}
          accessibilityLayer
          onMouseMove={(state) =>
            setActive(state.activeTooltipIndex == null ? null : Number(state.activeTooltipIndex))
          }
          onMouseLeave={() => setActive(null)}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            ticks={axisTicks(series.points, series.bucket, narrow ? PHONE_TICKS : undefined)}
            interval={0}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            itemSorter={(item) => KEYS.indexOf(item.dataKey as (typeof KEYS)[number])}
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  pointTitle(String(payload?.[0]?.payload?.start ?? ''), series.bucket)
                }
              />
            }
          />
          {!narrow && (
            <ChartLegend
              itemSorter={null}
              verticalAlign="top"
              content={<ChartLegendContent className="flex-wrap justify-start pb-3" />}
            />
          )}
          {KEYS.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="mails"
              fill={`var(--color-${key})`}
              maxBarSize={16}
              strokeWidth={2}
              className={narrow ? 'stroke-background' : 'stroke-surface-subtle'}
              isAnimationActive={false}
            >
              {data.map((point, i) => (
                <Cell key={point.start} fillOpacity={active === null || active === i ? 1 : 0.35} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
      <ChartTable
        caption={title}
        head={['Day', ...KEYS.map((key) => CONFIG[key].label)]}
        rows={data.map((point) => [point.label, ...KEYS.map((key) => point[key])])}
      />
    </>
  );
}

function JobMailsPerDay({ series }: { series: DashboardResponse['series'] }) {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm leading-5 font-semibold">{jobMailsTitle(series)}</h3>
        <p className="text-xs text-text-secondary">{seriesSpan(series.points)}</p>
      </div>
      <JobMailsChart series={series} />
    </div>
  );
}

/**
 * "Your mailbox" (owner, 3 Nov 2026): mails checked and job mails since the user joined, with
 * their count in the period, then the job mails of the period by kind.
 */
export function Mailbox({
  mailbox,
  series,
  period,
}: {
  mailbox: DashboardResponse['mailbox'];
  series: DashboardResponse['series'];
  period: DashboardPeriod;
}) {
  const stats = mailboxStats(mailbox, period).map((stat) => ({
    ...stat,
    line: stat.link ? (
      <Link to="/mails" search={{ application: 'none' }} className="text-link hover:underline">
        {stat.line}
      </Link>
    ) : (
      stat.line
    ),
  }));
  return (
    <div className="@container/mailbox overflow-hidden rounded-lg bg-surface-subtle">
      {/* The 2px gaps show the page colour: lines between the numbers. */}
      <dl className="grid grid-cols-2 gap-0.5 border-b-2 border-background bg-background @min-[760px]/mailbox:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-0 flex-col bg-surface-subtle p-4 @min-[760px]/mailbox:px-6 @min-[760px]/mailbox:py-5"
          >
            {/* The number shows first; the name comes first for screen readers. */}
            <dt className="order-2 text-xs text-text-primary">{stat.label}</dt>
            <dd className="order-1 text-[28px] leading-9 font-light tracking-[-0.01em] @min-[760px]/mailbox:text-[32px] @min-[760px]/mailbox:leading-10">
              {stat.value.toLocaleString('en-US')}
            </dd>
            <dd className="order-3 text-xs text-text-secondary">{stat.line}</dd>
          </div>
        ))}
      </dl>
      <JobMailsPerDay series={series} />
    </div>
  );
}
