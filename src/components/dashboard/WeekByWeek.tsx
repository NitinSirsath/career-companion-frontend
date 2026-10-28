import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { DashboardResponse } from '../../contracts/dashboard';
import { weekLabel } from '../../lib/dashboard';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart';
import { DashCard } from './DashCard';

const CONFIG = {
  applicationsSent: { label: 'Applications sent', color: 'var(--chart-1)' },
  answers: { label: 'Replies received', color: 'var(--chart-2)' },
  interviews: { label: 'Interviews reached', color: 'var(--chart-3)' },
} satisfies ChartConfig;

/** The last 12 weeks, whatever the period: does more applying bring more replies? */
export function WeekByWeek({ weeks }: { weeks: DashboardResponse['weeks'] }) {
  const data = weeks.map((week) => ({ ...week, label: weekLabel(week.weekStart) }));
  return (
    <DashCard title="Week by week" aside="Last 12 weeks, whatever the period">
      <ChartContainer
        config={CONFIG}
        className="mt-4 aspect-auto h-56 w-full md:h-64"
        aria-label="Applications, replies and interviews per week"
      >
        <BarChart data={data} barGap={2} margin={{ left: -24, right: 0, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            cursor={{ fill: 'var(--layer-hover)' }}
            content={<ChartTooltipContent labelFormatter={(label) => `Week of ${String(label)}`} />}
          />
          <ChartLegend
            verticalAlign="top"
            content={<ChartLegendContent className="justify-start pb-4" />}
          />
          {Object.keys(CONFIG).map((key) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              maxBarSize={14}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </DashCard>
  );
}
