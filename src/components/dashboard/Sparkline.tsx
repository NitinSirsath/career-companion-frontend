import { cn } from '../../lib/utils';

const WIDTH = 64;
const HEIGHT = 28;
const PAD = 3;

/** Weeks before the period grey; weeks inside it blue, an empty one faint. */
function barClass(beforePeriod: boolean, value: number) {
  if (beforePeriod) return 'fill-chart-4/45';
  return value ? 'fill-chart-1' : 'fill-chart-1/30';
}

/**
 * A small weekly trend as bars: grey for the weeks before the period, blue for the weeks inside it.
 * Small counts (0, 1, 2) read as steps, not as the spikes a line drew. It only adds to the number
 * beside it, so screen readers skip it.
 */
export function Sparkline({
  values,
  highlight,
  className,
}: {
  values: number[];
  /** How many of the last points are in the period. */
  highlight: number;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  const gap = 1.5;
  const bar = (WIDTH - gap * (values.length - 1)) / Math.max(1, values.length);
  const split = Math.max(0, values.length - highlight);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden
      className={cn('h-7 w-16 shrink-0', className)}
    >
      {values.map((value, i) => {
        const h = value ? Math.max(2, (value / max) * (HEIGHT - PAD)) : 1;
        return (
          <rect
            key={i}
            x={i * (bar + gap)}
            y={HEIGHT - h}
            width={bar}
            height={h}
            rx={0.75}
            className={barClass(i < split, value)}
          />
        );
      })}
    </svg>
  );
}
