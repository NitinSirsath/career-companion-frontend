import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import type { DashboardResponse } from '../../contracts/dashboard';
import { axisTicks, pointLabel, pointTitle, runningTotals, seriesSpan } from '../../lib/dashboard';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart';
import { ChartTable, DashCard } from './DashCard';

const CONFIG = {
  applicationsSent: { label: 'Applications sent', color: 'var(--chart-1)' },
  replies: { label: 'Replies received', color: 'var(--chart-2)' },
  interviews: { label: 'Interviews reached', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const KEYS = Object.keys(CONFIG) as (keyof typeof CONFIG)[];

type Series = DashboardResponse['series'];

/** The last value at the end of a line, with a dot ringed in the card colour. */
function endMark(last: number, key: keyof typeof CONFIG) {
  return function EndMark(props: { cx?: number; cy?: number; index?: number; value?: unknown }) {
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
          className="stroke-surface-subtle"
        />
      </g>
    );
  };
}

function endLabel(last: number) {
  return function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
    value?: unknown;
  }) {
    if (props.index !== last) return null;
    return (
      <text
        x={Number(props.x) + 10}
        y={Number(props.y) + 4}
        className="fill-text-primary text-[13px] font-medium"
      >
        {String(props.value)}
      </text>
    );
  };
}

/**
 * Applications, replies and interviews added up over the period (owner, 3 Nov 2026): the gap
 * between the lines shows how many applications get an answer.
 */
export function RunningTotal({ series }: { series: Series }) {
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
    activeDot: { r: 4, strokeWidth: 2, className: 'stroke-surface-subtle' },
    label: endLabel(last),
  });
  return (
    <DashCard title="Running total this period" aside={seriesSpan(series.points)}>
      <ChartContainer
        config={CONFIG}
        className="mt-3 aspect-auto h-56 w-full @min-[600px]:h-64"
        aria-label="Running total of applications, replies and interviews"
      >
        <ComposedChart data={data} margin={{ left: -20, right: 32, top: 12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            ticks={axisTicks(series.points, series.bucket)}
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
          <ChartLegend
            itemSorter={null}
            verticalAlign="top"
            content={<ChartLegendContent className="justify-start pb-3" />}
          />
          <Area
            {...line('applicationsSent')}
            fill="var(--color-applicationsSent)"
            fillOpacity={0.1}
          />
          <Line {...line('replies')} />
          <Line {...line('interviews')} />
        </ComposedChart>
      </ChartContainer>
      <ChartTable
        caption="Running total this period"
        head={['Day', ...KEYS.map((key) => CONFIG[key].label)]}
        rows={data.map((point) => [point.label, ...KEYS.map((key) => point[key])])}
      />
    </DashCard>
  );
}
