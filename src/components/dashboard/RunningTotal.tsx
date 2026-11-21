import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  usePlotArea,
  useYAxisScale,
} from 'recharts';
import type { DashboardResponse } from '../../contracts/dashboard';
import {
  PHONE_TICKS,
  axisTicks,
  pointLabel,
  pointTitle,
  runningTotals,
  seriesSpan,
  spreadLabels,
} from '../../lib/dashboard';
import { cn } from '../../lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import { ChartTable, DashCard } from './DashCard';

const CONFIG = {
  applicationsSent: { label: 'Applied', color: 'var(--chart-1)' },
  replies: { label: 'Replies', color: 'var(--chart-2)' },
  interviews: { label: 'Interviews', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];

/** End labels stay this far apart, so close lines never print over each other. */
const LABEL_GAP = 16;

type Series = DashboardResponse['series'];
type Total = ReturnType<typeof runningTotals>[number];

/** The dot at the end of a line, ringed in the page colour. */
function endMark(last: number, key: keyof typeof CONFIG) {
  return function EndMark(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (index !== last || cx === undefined || cy === undefined) return <g key={index} />;
    return (
      <g key={index}>
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill={`var(--color-${key})`}
          strokeWidth={2}
          className="stroke-background"
        />
      </g>
    );
  };
}

/**
 * The number and name at each line's end, "24 Applied" (owner, 21 Nov 2026): no legend and nothing
 * only on a tap. Labels that would touch are pushed down.
 */
function EndLabels({ last }: { last: Total | undefined }) {
  const plot = usePlotArea();
  const y = useYAxisScale();
  if (!last || !plot || !y) return null;
  const heights = spreadLabels(
    KEYS.map((key) => Number(y(last[key]))),
    LABEL_GAP,
  );
  const labels = KEYS.map((key, i) => ({ key, value: last[key], y: heights[i] }));
  return (
    <g aria-hidden>
      {labels.map((label) => (
        <text
          key={label.key}
          x={plot.x + plot.width + 10}
          y={label.y + 4}
          className="fill-text-secondary text-[12px]"
        >
          <tspan className="fill-text-primary text-[13px] font-semibold">{label.value}</tspan>{' '}
          {CONFIG[label.key].label}
        </text>
      ))}
    </g>
  );
}

/** The chart alone: the phone draws it on the page, the laptop in a card. */
export function RunningTotalChart({
  series,
  className,
  narrow = false,
}: {
  series: Series;
  className?: string;
  /** On a phone: fewer dates under it. */
  narrow?: boolean;
}) {
  const data = runningTotals(series.points).map((point) => ({
    ...point,
    label: pointLabel(point.start),
  }));
  const last = data.length - 1;
  const line = (key: keyof typeof CONFIG) => ({
    dataKey: key,
    type: 'linear' as const,
    stroke: `var(--color-${key})`,
    strokeWidth: 2,
    isAnimationActive: false,
    dot: endMark(last, key),
    activeDot: { r: 4, strokeWidth: 2, className: 'stroke-background' },
  });
  return (
    <>
      <ChartContainer
        config={CONFIG}
        className={cn('aspect-auto h-52 w-full @min-[600px]:h-64', className)}
        aria-label="Applications, replies and interviews added up over the period"
      >
        <ComposedChart data={data} margin={{ left: -20, right: 92, top: 12 }} accessibilityLayer>
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
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) =>
                  `By ${pointTitle(String(payload?.[0]?.payload?.start ?? ''), series.bucket)}`
                }
              />
            }
          />
          <Area
            {...line('applicationsSent')}
            fill="var(--color-applicationsSent)"
            fillOpacity={0.1}
          />
          <Line {...line('replies')} />
          <Line {...line('interviews')} />
          <EndLabels last={data[last]} />
        </ComposedChart>
      </ChartContainer>
      <ChartTable
        caption="Over time"
        head={['Day', ...KEYS.map((key) => CONFIG[key].label)]}
        rows={data.map((point) => [point.label, ...KEYS.map((key) => point[key])])}
      />
    </>
  );
}

/**
 * Applications, replies and interviews added up over the period (owner, 3 Nov 2026): the gap
 * between the lines shows how many applications get an answer. "Over time" since 21 Nov 2026.
 */
export function RunningTotal({ series }: { series: Series }) {
  return (
    <DashCard title="Over time" aside={seriesSpan(series.points)}>
      <RunningTotalChart series={series} className="mt-3" />
    </DashCard>
  );
}
